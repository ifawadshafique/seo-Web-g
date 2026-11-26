import { boundedJson } from "@/lib/request-body";
import prisma from "@/lib/prisma";
import { protectedRoute } from "@/lib/auth";
import { contentResult } from "@/lib/api-error";
import { savePage } from "@/lib/page-publishing";
import { revalidatePath } from "next/cache";
export async function GET(request: Request) {
  return protectedRoute(request, "settings", async () =>
    Response.json(await prisma.page.findMany({ orderBy: { title: "asc" } })),
  );
}
export async function POST(request: Request) {
  return protectedRoute(request, "settings", (session) =>
    contentResult(async () => {
      const page = await savePage(
        await boundedJson(request, 1048576),
        session.user.id,
      );
      revalidatePath("/", "layout");
      return Response.json(page);
    }),
  );
}
