import { z } from "zod";
import prisma from "@/lib/prisma";
import { protectedRoute } from "@/lib/auth";
import { contentResult, ContentError } from "@/lib/api-error";
import { slugSchema, wordCount } from "@/lib/content-validation";
import { revalidatePath } from "next/cache";
export async function GET(request: Request) {
  return protectedRoute(request, "content", async () =>
    Response.json({
      categories: await prisma.category.findMany({ orderBy: { name: "asc" } }),
      tags: await prisma.tag.findMany({ orderBy: { name: "asc" } }),
    }),
  );
}
const input = z.object({
  kind: z.enum(["category", "tag"]),
  operation: z.enum(["save", "merge"]).default("save"),
  id: z.number().int().positive().optional(),
  targetId: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(100).optional(),
  slug: slugSchema.optional(),
  description: z.string().max(30000).default(""),
});
export async function POST(request: Request) {
  return protectedRoute(request, "content", (session) =>
    contentResult(async () => {
      const data = input.parse(await request.json());
      await prisma.$transaction(async (tx) => {
        if (data.operation === "merge") {
          if (!data.id || !data.targetId || data.id === data.targetId)
            throw new ContentError("Choose two different terms");
          if (data.kind === "category") {
            const target = await tx.category.findUnique({
              where: { id: data.targetId },
            });
            if (!target) throw new ContentError("Target category not found");
            await tx.post.updateMany({
              where: { categoryId: data.id },
              data: { categoryId: data.targetId },
            });
            await tx.category.delete({ where: { id: data.id } });
          } else {
            if (!(await tx.tag.findUnique({ where: { id: data.targetId } })))
              throw new ContentError("Target tag not found");
            const links = await tx.postTag.findMany({
              where: { tagId: data.id },
            });
            if (links.length)
              await tx.postTag.createMany({
                data: links.map((link) => ({
                  postId: link.postId,
                  tagId: data.targetId!,
                })),
                skipDuplicates: true,
              });
            await tx.postTag.deleteMany({ where: { tagId: data.id } });
            await tx.tag.delete({ where: { id: data.id } });
          }
        } else {
          if (!data.name || !data.slug)
            throw new ContentError("Supply a name and URL slug");
          if (wordCount(data.description) < 150)
            throw new ContentError(
              "Category and tag introductions need at least 150 words",
            );
          const values = {
            name: data.name,
            slug: data.slug,
            description: data.description,
          };
          if (data.kind === "category") {
            if (data.id)
              await tx.category.update({
                where: { id: data.id },
                data: values,
              });
            else await tx.category.create({ data: values });
          } else {
            if (data.id)
              await tx.tag.update({ where: { id: data.id }, data: values });
            else await tx.tag.create({ data: values });
          }
        }
        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            action: `TAXONOMY_${data.operation.toUpperCase()}`,
            entityType: data.kind,
            entityId: data.id,
            metadata: { targetId: data.targetId ?? null },
          },
        });
      });
      revalidatePath("/", "layout");
      return Response.json({ ok: true });
    }),
  );
}
