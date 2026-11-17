import { protectedRoute } from "@/lib/auth";
import prisma from "@/lib/prisma";
export async function GET(request: Request) {
  return protectedRoute(request, "audit", async () =>
    Response.json(
      await prisma.auditLog.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
      }),
    ),
  );
}
