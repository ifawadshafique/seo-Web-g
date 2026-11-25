import { ContentError } from "./api-error";
import { postInput, publicationErrors } from "./content-validation";
import prisma from "./prisma";

export function publishReviewedJob(
  id: number,
  reviewedRevision: string,
  actorId: number,
  confirmShort: boolean,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Post" WHERE id = ${id} FOR UPDATE`;
    const post = await tx.post.findFirst({
      where: { id, contentType: "JOB", status: "DRAFT", deletedAt: null },
      include: { jobDetails: true },
    });
    if (!post) throw new ContentError("Job draft not found", 404);
    if (post.updatedAt.toISOString() !== reviewedRevision)
      throw new ContentError(
        "The draft changed. Review it again before publishing.",
        409,
      );
    const job = post.jobDetails;
    const input = postInput.parse({
      ...post,
      status: "PUBLISHED",
      confirmShort,
      excerpt: post.excerpt ?? "",
      metaTitle: post.metaTitle ?? "",
      metaDescription: post.metaDescription ?? "",
      canonicalUrl: post.canonicalUrl ?? "",
      job: job
        ? {
            ...job,
            location: job.location ?? "",
            country: job.country ?? "",
            workplaceType: job.workplaceType ?? "On-site",
            employmentType: job.employmentType ?? "",
            salaryCurrency: job.salaryCurrency ?? "",
            salaryPeriod: job.salaryPeriod ?? "",
            closingDate: "",
            attested: true,
          }
        : undefined,
    });
    const errors = publicationErrors(input, "ADMIN");
    if (errors.length) throw new ContentError(errors.join(". "));
    const now = new Date();
    if (
      !job ||
      job.jobStatus !== "OPEN" ||
      (job.closingDate && job.closingDate <= now)
    )
      throw new ContentError(
        "Only open jobs with a future closing date or no closing date can be published",
      );
    if (
      await tx.jobReport.count({
        where: { postId: id, status: "UNDER_REVIEW" },
      })
    )
      throw new ContentError("Resolve reports under review before publishing");

    const saved = await tx.post.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: now, scheduledAt: null },
      select: { id: true, title: true, slug: true, status: true },
    });
    await tx.jobDetails.update({
      where: { postId: id },
      data: { linkAttestedAt: now, linkAttestedBy: String(actorId) },
    });
    await tx.publishTask.updateMany({
      where: { postId: id, state: "PENDING" },
      data: { state: "CANCELLED", finishedAt: now },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "POST_PUBLISHED_SAVED",
        entityType: "Post",
        entityId: id,
        metadata: { via: "mcp", shortContentConfirmed: confirmShort },
      },
    });
    return saved;
  });
}
