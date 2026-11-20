import { boundedJson } from "@/lib/request-body";
import prisma from "@/lib/prisma";
import { protectedRoute } from "@/lib/auth";
import { contentResult } from "@/lib/api-error";
import { postInclude, savePost } from "@/lib/publishing";
import { revalidatePath } from "next/cache";
import { Prisma, PostStatus } from "@prisma/client";
export async function GET(request: Request) {
  return protectedRoute(request, "content", () =>
    contentResult(async () => {
      const url = new URL(request.url);
      const status = url.searchParams.get("status");
      const where: Prisma.PostWhereInput = { deletedAt: null };
      if (status && Object.values(PostStatus).includes(status as PostStatus))
        where.status = status as PostStatus;
      const search = url.searchParams.get("q");
      if (search) where.title = { contains: search, mode: "insensitive" };
      const category = Number(url.searchParams.get("category"));
      if (category > 0) where.categoryId = category;
      const date = url.searchParams.get("date");
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date))
        where.updatedAt = { gte: new Date(date) };
      const posts = await prisma.post.findMany({
        where,
        include: postInclude,
        orderBy: { updatedAt: "desc" },
        take: 200,
      });
      return Response.json(posts);
    }),
  );
}
export async function POST(request: Request) {
  return protectedRoute(request, "content", (session) =>
    contentResult(async () => {
      const result = await savePost(
        await boundedJson(request, 1048576),
        session.user,
      );
      revalidatePath("/", "layout");
      return Response.json(result, { status: 201 });
    }),
  );
}
