import { boundedJson } from "@/lib/request-body";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { protectedRoute } from "@/lib/auth";
import { contentResult } from "@/lib/api-error";
export async function POST(request: Request) {
  return protectedRoute(request, "settings", (session) =>
    contentResult(async () => {
      const { id } = z
        .object({ id: z.number().int().positive() })
        .parse(await boundedJson(request, 65536));
      await prisma.$transaction(async (tx) => {
        await tx.publishTask.update({
          where: { id },
          data: {
            state: "RETRY",
            attempts: 0,
            nextAttemptAt: new Date(),
            lastError: null,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            action: "PUBLISH_TASK_RETRIED",
            entityType: "PublishTask",
            entityId: id,
          },
        });
      });
      return Response.json({ ok: true });
    }),
  );
}
