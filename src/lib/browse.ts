import { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { publicWhere, postInclude } from "./publishing";
export type SearchParams = Record<string, string | string[] | undefined>;
const postsPerPage = 9;
export const param = (params: SearchParams, key: string) =>
  typeof params[key] === "string" ? (params[key] as string) : "";
export async function browsePosts(
  params: SearchParams = {},
  scope?: { category?: string; tag?: string },
) {
  const pageValue = Number(param(params, "page") || 1);
  const page =
    Number.isSafeInteger(pageValue) && pageValue > 0 && pageValue <= 100000
      ? pageValue
      : 1;
  const where: Prisma.PostWhereInput = publicWhere();
  const q = param(params, "q").trim().slice(0, 200);
  if (q) {
    const ids = await prisma.$queryRaw<
      { id: number }[]
    >`SELECT id FROM "Post" WHERE status='PUBLISHED' AND deleted_at IS NULL AND published_at <= (now() AT TIME ZONE 'UTC') AND to_tsvector('english', coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || body) @@ websearch_to_tsquery('english', ${q})`;
    where.id = { in: ids.map((row) => row.id) };
  }
  if (scope?.category) where.category = { slug: scope.category };
  const tag = scope?.tag || param(params, "tag");
  if (tag) where.tags = { some: { tag: { slug: tag } } };
  const country = param(params, "country");
  if (country) where.jobDetails = { country };
  const [posts, total, categories, tags, countries] = await Promise.all([
    prisma.post.findMany({
      where,
      include: postInclude,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * postsPerPage,
      take: postsPerPage,
    }),
    prisma.post.count({ where }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.jobDetails.findMany({
      where: { post: publicWhere(), country: { not: null } },
      distinct: ["country"],
      select: { country: true },
      orderBy: { country: "asc" },
    }),
  ]);
  return {
    posts,
    total,
    page,
    totalPages: Math.ceil(total / postsPerPage),
    categories,
    tags,
    countries: countries.map((row) => row.country!).filter(Boolean),
  };
}
