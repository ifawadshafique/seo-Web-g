import { z } from "zod";
import prisma from "@/lib/prisma";
import { protectedRoute } from "@/lib/auth";
import { ContentError, contentResult } from "@/lib/api-error";
import { revalidatePath } from "next/cache";
export async function GET(request: Request) {
  return protectedRoute(request, "settings", async () =>
    Response.json(
      await prisma.jobReport.findMany({
        take: 200,
        orderBy: [{ createdAt: "desc" }],
        include: {
          post: { select: { id: true, title: true, slug: true, status: true } },
        },
      }),
    ),
  );
}
const input = z.object({
  id: z.number().int().positive(),
  status: z.enum(["UNDER_REVIEW", "RESOLVED", "REJECTED"]),
  resolution: z.string().trim().min(10).max(2000),
});
export async function POST(request: Request) {
  return protectedRoute(request, "settings", (session) =>
    contentResult(async () => {
      const data = input.parse(await request.json());
      await prisma.$transaction(async (tx) => {
        const report = await tx.jobReport.findUnique({
          where: { id: data.id },
        });
        if (!report) throw new ContentError("Report not found", 404);
        await tx.jobReport.update({
          where: { id: data.id },
          data: {
            status: data.status,
            resolution: data.resolution,
            reviewedAt: new Date(),
            reviewedBy: String(session.user.id),
          },
        });
        if (data.status === "UNDER_REVIEW") {
          await tx.post.update({
            where: { id: report.postId },
            data: { status: "UNPUBLISHED" },
          });
          await tx.publishTask.updateMany({
            where: { postId: report.postId },
            data: { state: "CANCELLED", finishedAt: new Date() },
          });
        }
        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            action: `REPORT_${data.status}`,
            entityType: "JobReport",
            entityId: data.id,
            metadata: { postId: report.postId },
          },
        });
      });
      revalidatePath("/", "layout");
      return Response.json({ ok: true });
    }),
  );
}
