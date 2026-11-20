import { boundedJson } from "@/lib/request-body";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { protectedRoute } from "@/lib/auth";
import { contentResult, ContentError } from "@/lib/api-error";
import { postInclude } from "@/lib/publishing";
import { postInput, publicationErrors } from "@/lib/content-validation";
import { revalidatePath } from "next/cache";
const input = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100),
  action: z.enum(["publish", "unpublish", "category", "delete"]),
  categoryId: z.number().int().positive().optional(),
  confirmShort: z.boolean().default(false),
});
export async function POST(request: Request) {
  return protectedRoute(request, "content", (session) =>
    contentResult(async () => {
      const data = input.parse(await boundedJson(request, 65536));
      const ids = [...new Set(data.ids)];
      await prisma.$transaction(async (tx) => {
        const posts = await tx.post.findMany({
          where: { id: { in: ids }, deletedAt: null },
          include: postInclude,
        });
        if (posts.length !== ids.length)
          throw new ContentError("One or more posts no longer exist");
        if (
          data.action === "publish" &&
          (await tx.jobReport.count({
            where: { postId: { in: ids }, status: "UNDER_REVIEW" },
          }))
        )
          throw new ContentError(
            "Resolve reports under review before bulk publication",
          );
        if (data.action === "publish")
          for (const post of posts) {
            const validation = postInput.parse({
              ...post,
              excerpt: post.excerpt ?? "",
              metaTitle: post.metaTitle ?? "",
              metaDescription: post.metaDescription ?? "",
              canonicalUrl: post.canonicalUrl ?? "",
              tagIds: post.tags.map((link) => link.tagId),
              confirmShort: data.confirmShort,
              status: "PUBLISHED",
              job: post.jobDetails
                ? {
                    ...post.jobDetails,
                    location: post.jobDetails.location ?? "",
                    country: post.jobDetails.country ?? "",
                    employmentType: post.jobDetails.employmentType ?? "",
                    workplaceType: post.jobDetails.workplaceType ?? "On-site",
                    salaryCurrency: post.jobDetails.salaryCurrency ?? "",
                    salaryPeriod: post.jobDetails.salaryPeriod ?? "",
                    closingDate: "",
                    attested: !!post.jobDetails.linkAttestedAt,
                  }
                : undefined,
            });
            const errors = publicationErrors(validation, session.user.role);
            if (errors.length)
              throw new ContentError(`${post.title}: ${errors.join(". ")}`);
          }
        if (data.action === "category") {
          if (
            !data.categoryId ||
            !(await tx.category.findUnique({ where: { id: data.categoryId } }))
          )
            throw new ContentError("Choose a valid destination category");
          await tx.post.updateMany({
            where: { id: { in: ids } },
            data: { categoryId: data.categoryId },
          });
        } else {
          for (const post of posts)
            await tx.post.update({
              where: { id: post.id },
              data:
                data.action === "publish"
                  ? {
                      status: "PUBLISHED",
                      publishedAt: post.publishedAt ?? new Date(),
                      scheduledAt: null,
                    }
                  : data.action === "delete"
                    ? { status: "UNPUBLISHED", deletedAt: new Date() }
                    : { status: "UNPUBLISHED" },
            });
          await tx.publishTask.updateMany({
            where: { postId: { in: ids } },
            data: { state: "CANCELLED", finishedAt: new Date() },
          });
        }
        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            action: `POSTS_BULK_${data.action.toUpperCase()}`,
            entityType: "Post",
            metadata: { ids },
          },
        });
      });
      revalidatePath("/", "layout");
      return Response.json({ ok: true });
    }),
  );
}
