import { protectedRoute } from "@/lib/auth";
import prisma from "@/lib/prisma";
export async function GET(request: Request) {
  return protectedRoute(request, "settings", async () =>
    Response.json({
      checkedAt: new Date().toISOString(),
      messages: await prisma.contactMessage.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      mail: await prisma.mailOutbox.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      worker: await prisma.workerRun.findMany(),
      tasks: await prisma.publishTask.findMany({
        where: { state: { in: ["FAILED", "RETRY"] } },
        take: 50,
      }),
    }),
  );
}
