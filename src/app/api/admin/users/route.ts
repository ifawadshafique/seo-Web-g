import { protectedRoute } from "@/lib/auth";
import prisma from "@/lib/prisma";
export async function GET(request: Request) {
  return protectedRoute(request, "users", async () =>
    Response.json(
      await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          mfaEnabled: true,
          lastLoginAt: true,
        },
      }),
    ),
  );
}
