import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
// Public projections never include credentials, draft bodies, or private author fields.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
    return Response.json({ error: "Invalid page" }, { status: 400 });
  const where: Prisma.PostWhereInput = {
    status: "PUBLISHED",
    deletedAt: null,
    publishedAt: { lte: new Date() },
  };
  const search = url.searchParams.get("search")?.slice(0, 200);
  if (search)
    where.OR = ["title", "excerpt", "body"].map((key) => ({
      [key]: { contains: search, mode: "insensitive" },
    }));
  const category = url.searchParams.get("category");
  const tag = url.searchParams.get("tag");
  if (category) where.category = { slug: category };
  if (tag) where.tags = { some: { tag: { slug: tag } } };
  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
        category: true,
        author: { select: { name: true } },
      },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * 12,
      take: 12,
    }),
    prisma.post.count({ where }),
  ]);
  return Response.json({ posts, total, page, pageSize: 12 });
}
// Administrative writes are authorized separately under /api/admin/posts.
