import { wordCount } from "./content-validation";
import { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { publicWhere } from "./publishing";
export function indexablePosts(): Prisma.PostWhereInput {
  return { ...publicWhere(), noindex: false };
}
export async function tagThreshold() {
  const setting = await prisma.setting.findUnique({
    where: { key: "tag_index_threshold" },
  });
  const value = Number(setting?.value ?? 5);
  return Number.isSafeInteger(value) && value >= 1 && value <= 100 ? value : 5;
}
export async function indexableTerms(kind: "category" | "tag") {
  if (kind === "category") {
    const terms = await prisma.category.findMany({
      include: {
        posts: { where: indexablePosts(), select: { updatedAt: true } },
      },
      orderBy: { id: "asc" },
    });
    return terms.map((term) => ({
      slug: term.slug,
      lastmod: term.posts.reduce<Date | undefined>(
        (date, post) =>
          !date || date < post.updatedAt ? post.updatedAt : date,
        term.updatedAt,
      ),
    }));
  }
  const threshold = await tagThreshold();
  const terms = await prisma.tag.findMany({
    include: {
      posts: {
        where: { post: indexablePosts() },
        include: { post: { select: { updatedAt: true } } },
      },
    },
    orderBy: { id: "asc" },
  });
  return terms
    .filter(
      (term) =>
        term.posts.length >= threshold &&
        wordCount(term.description ?? "") >= 150,
    )
    .map((term) => ({
      slug: term.slug,
      lastmod: term.posts.reduce<Date | undefined>(
        (date, link) =>
          !date || date < link.post.updatedAt ? link.post.updatedAt : date,
        term.updatedAt,
      ),
    }));
}
