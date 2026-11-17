import { absoluteUrl, countryCode } from "./seo";
import { linkResponds } from "./check-links";
import { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { ContentError } from "./api-error";
import {
  cleanBody,
  fromSiteTime,
  plainText,
  postInput,
  publicationErrors,
  wordCount,
} from "./content-validation";
import { siteSettings } from "./settings";

export const postInclude = {
  category: true,
  tags: { include: { tag: true } },
  jobDetails: true,
  featuredMedia: true,
  ogMedia: true,
  author: { select: { id: true, name: true } },
} satisfies Prisma.PostInclude;
export type FullPost = Prisma.PostGetPayload<{ include: typeof postInclude }>;
export function publicWhere(): Prisma.PostWhereInput {
  return {
    status: "PUBLISHED",
    deletedAt: null,
    publishedAt: { lte: new Date() },
  };
}
export async function savePost(
  input: unknown,
  actor: { id: number; role: string },
  id?: number,
) {
  const data = postInput.parse(input);
  data.body = cleanBody(data.body);
  const errors = publicationErrors(data, actor.role);
  if (data.canonicalUrl && data.canonicalUrl !== absoluteUrl("/" + data.slug))
    throw new ContentError("Canonical URLs must match this post’s own URL");
  if (errors.length) throw new ContentError(errors.join(". "));
  const settings = await siteSettings();
  let scheduledAt: Date | null = null;
  if (data.status === "SCHEDULED") {
    try {
      scheduledAt = fromSiteTime(data.scheduledLocal, settings.site_timezone);
    } catch {
      throw new ContentError(
        "Enter a valid scheduled time in the site timezone",
      );
    }
    if (scheduledAt <= new Date())
      throw new ContentError("Scheduled time must be in the future");
  }
  let closingDate: Date | null = null;
  if (data.contentType === "JOB" && data.job?.closingDate) {
    try {
      closingDate = fromSiteTime(data.job.closingDate, settings.site_timezone);
    } catch {
      throw new ContentError("Enter a valid closing date in the site timezone");
    }
  }
  const warnings: string[] = [];
  if (data.contentType === "JOB" && !countryCode(data.job?.country ?? null))
    warnings.push(
      "Use a recognized country name or ISO country code before this job can receive JobPosting markup.",
    );
  if (wordCount(data.body) < 400)
    warnings.push("This post is shorter than 400 words.");
  if ((data.metaTitle || data.title).length > 60)
    warnings.push("The search title exceeds 60 characters.");
  if (data.metaDescription.length < 140 || data.metaDescription.length > 160)
    warnings.push("Use 140–160 characters for the meta description.");
  const duplicate = await prisma.post.findFirst({
    where: {
      id: id ? { not: id } : undefined,
      deletedAt: null,
      OR: [
        { title: data.title },
        ...(data.metaDescription
          ? [{ metaDescription: data.metaDescription }]
          : []),
      ],
    },
    select: { id: true },
  });
  if (duplicate)
    warnings.push(
      "Another post has the same title or description. Review it for duplication.",
    );
  const recent = await prisma.post.findMany({
    where: { deletedAt: null, ...(id ? { id: { not: id } } : {}) },
    take: 100,
    orderBy: { updatedAt: "desc" },
    select: { body: true },
  });
  const words = new Set(
    plainText(data.body).toLowerCase().split(/\W+/).filter(Boolean),
  );
  if (
    words.size > 15 &&
    recent.some((post) => {
      const other = new Set(
        plainText(post.body).toLowerCase().split(/\W+/).filter(Boolean),
      );
      return (
        [...words].filter((word) => other.has(word)).length /
          Math.max(words.size, other.size) >
        0.85
      );
    })
  )
    warnings.push(
      "This body closely resembles an existing post. Review originality.",
    );
  if (
    ["PUBLISHED", "SCHEDULED"].includes(data.status) &&
    data.contentType === "JOB" &&
    data.job
  ) {
    const links = [...new Set([data.job.sourceUrl, data.job.applicationUrl])];
    const responses = await Promise.all(links.map(linkResponds));
    links.forEach((link, index) => {
      if (!responses[index])
        warnings.push(
          `Source link could not be reached; check manually: ${link}`,
        );
    });
  }
  const post = await prisma.$transaction(async (tx) => {
    if (id)
      await tx.$queryRaw`SELECT id FROM "Post" WHERE id = ${id} FOR UPDATE`;
    const old = id
      ? await tx.post.findUnique({
          where: { id },
          include: { jobDetails: true },
        })
      : null;
    if (id && (!old || old.deletedAt))
      throw new ContentError("Post not found", 404);
    if (
      old &&
      ["PUBLISHED", "SCHEDULED"].includes(data.status) &&
      (await tx.jobReport.count({
        where: { postId: old.id, status: "UNDER_REVIEW" },
      }))
    )
      throw new ContentError(
        "Resolve reports under review before republishing this listing",
      );
    if (old && old.slug !== data.slug) {
      if (
        await tx.redirect.findUnique({ where: { fromPath: `/${data.slug}` } })
      )
        throw new ContentError("This URL is already used by a redirect");
      // Flatten old inbound redirects before inserting the previous URL; no loops or chains.
      await tx.redirect.updateMany({
        where: { toPath: `/${old.slug}` },
        data: { toPath: `/${data.slug}` },
      });
      await tx.redirect.create({
        data: {
          fromPath: `/${old.slug}`,
          toPath: `/${data.slug}`,
          statusCode: 301,
        },
      });
    }
    if (
      !old &&
      (await tx.redirect.findUnique({ where: { fromPath: `/${data.slug}` } }))
    )
      throw new ContentError("This URL is already used by a redirect");
    const common = {
      title: data.title,
      slug: data.slug,
      contentType: data.contentType,
      body: data.body,
      excerpt: data.excerpt,
      categoryId: data.categoryId,
      featuredMediaId: data.featuredMediaId,
      ogMediaId: data.ogMediaId,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      canonicalUrl: data.canonicalUrl || null,
      noindex: data.noindex,
      adsEnabled: data.adsEnabled,
      status: data.status,
      scheduledAt,
      publishedAt:
        data.status === "PUBLISHED"
          ? (old?.publishedAt ?? new Date())
          : (old?.publishedAt ?? null),
    };
    const saved = old
      ? await tx.post.update({ where: { id: old.id }, data: common })
      : await tx.post.create({ data: { ...common, authorId: actor.id } });
    await tx.postTag.deleteMany({ where: { postId: saved.id } });
    if (data.tagIds.length)
      await tx.postTag.createMany({
        data: [...new Set(data.tagIds)].map((tagId) => ({
          postId: saved.id,
          tagId,
        })),
      });
    if (data.contentType === "JOB" && data.job) {
      const { attested, ...job } = data.job;
      const sourceChanged =
        old?.jobDetails?.sourceUrl !== job.sourceUrl ||
        old?.jobDetails?.applicationUrl !== job.applicationUrl;
      const jobStatus =
        job.jobStatus === "OPEN" && closingDate && closingDate <= new Date()
          ? "EXPIRED"
          : job.jobStatus;
      const details = {
        ...job,
        closingDate,
        jobStatus,
        jobStatusChangedAt:
          old?.jobDetails?.jobStatus === jobStatus
            ? old.jobDetails.jobStatusChangedAt
            : new Date(),
        linkAttestedBy: attested ? String(actor.id) : null,
        linkAttestedAt: attested ? new Date() : null,
        ...(sourceChanged
          ? {
              verificationStatus: "NONE" as const,
              verifiedAt: null,
              verifiedBy: null,
              verificationNote: null,
            }
          : {}),
      };
      await tx.jobDetails.upsert({
        where: { postId: saved.id },
        create: { ...details, postId: saved.id },
        update: details,
      });
    } else await tx.jobDetails.deleteMany({ where: { postId: saved.id } });
    if (scheduledAt)
      await tx.publishTask.upsert({
        where: { postId: saved.id },
        create: {
          postId: saved.id,
          runAt: scheduledAt,
          nextAttemptAt: scheduledAt,
        },
        update: {
          runAt: scheduledAt,
          nextAttemptAt: scheduledAt,
          state: "PENDING",
          attempts: 0,
          lastError: null,
          finishedAt: null,
        },
      });
    else
      await tx.publishTask.updateMany({
        where: { postId: saved.id },
        data: { state: "CANCELLED", finishedAt: new Date() },
      });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: old ? `POST_${data.status}_SAVED` : "POST_CREATED",
        entityType: "Post",
        entityId: saved.id,
        metadata: {
          shortContentConfirmed: data.confirmShort && actor.role === "ADMIN",
        },
      },
    });
    return saved;
  });
  return { post, warnings };
}
export async function duplicatePost(id: number, actorId: number) {
  return prisma.$transaction(async (tx) => {
    const source = await tx.post.findFirst({
      where: { id, deletedAt: null },
      include: { tags: true, jobDetails: true },
    });
    if (!source) throw new ContentError("Post not found", 404);
    const slug =
      source.slug.slice(0, 58) + "-copy-" + crypto.randomUUID().slice(0, 8);
    const saved = await tx.post.create({
      data: {
        title: `${source.title} (copy)`,
        slug,
        contentType: source.contentType,
        excerpt: source.excerpt,
        body: source.body,
        categoryId: source.categoryId,
        authorId: actorId,
        featuredMediaId: source.featuredMediaId,
        ogMediaId: source.ogMediaId,
        metaTitle: source.metaTitle,
        metaDescription: source.metaDescription,
        noindex: source.noindex,
        adsEnabled: source.adsEnabled,
        tags: { create: source.tags.map((tag) => ({ tagId: tag.tagId })) },
      },
    });
    if (source.jobDetails) {
      const { postId: _postId, ...job } = source.jobDetails;
      void _postId;
      await tx.jobDetails.create({
        data: {
          ...job,
          postId: saved.id,
          linkAttestedBy: null,
          linkAttestedAt: null,
          verificationStatus: "NONE",
          verifiedAt: null,
          verifiedBy: null,
          verificationNote: null,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId,
        action: "POST_DUPLICATED",
        entityType: "Post",
        entityId: saved.id,
      },
    });
    return saved;
  });
}
export async function removePost(id: number, actorId: number) {
  return prisma.$transaction(async (tx) => {
    const saved = await tx.post.update({
      where: { id },
      data: { deletedAt: new Date(), status: "UNPUBLISHED" },
    });
    await tx.publishTask.updateMany({
      where: { postId: id },
      data: { state: "CANCELLED", finishedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "POST_DELETED",
        entityType: "Post",
        entityId: id,
      },
    });
    return saved;
  });
}
