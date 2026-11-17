import prisma from "@/lib/prisma";
import { protectedRoute } from "@/lib/auth";
import { ContentError, contentResult } from "@/lib/api-error";
import {
  duplicatePost,
  postInclude,
  removePost,
  savePost,
} from "@/lib/publishing";
import { revalidatePath } from "next/cache";
type Context = { params: Promise<{ id: string }> };
async function idOf(context: Context) {
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new ContentError("Invalid post", 404);
  return id;
}
export async function GET(request: Request, context: Context) {
  return protectedRoute(request, "content", () =>
    contentResult(async () => {
      const post = await prisma.post.findFirst({
        where: { id: await idOf(context), deletedAt: null },
        include: postInclude,
      });
      if (!post) throw new ContentError("Not found", 404);
      return Response.json(post);
    }),
  );
}
export async function PATCH(request: Request, context: Context) {
  return protectedRoute(request, "content", (session) =>
    contentResult(async () => {
      const result = await savePost(
        await request.json(),
        session.user,
        await idOf(context),
      );
      revalidatePath("/", "layout");
      return Response.json(result);
    }),
  );
}
export async function DELETE(request: Request, context: Context) {
  return protectedRoute(request, "content", (session) =>
    contentResult(async () => {
      await removePost(await idOf(context), session.user.id);
      revalidatePath("/", "layout");
      return Response.json({ ok: true });
    }),
  );
}
export async function POST(request: Request, context: Context) {
  return protectedRoute(request, "content", (session) =>
    contentResult(async () =>
      Response.json(await duplicatePost(await idOf(context), session.user.id), {
        status: 201,
      }),
    ),
  );
}
