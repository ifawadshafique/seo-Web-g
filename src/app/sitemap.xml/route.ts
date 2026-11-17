export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { indexablePosts, indexableTerms } from "@/lib/indexing";
import { absoluteUrl } from "@/lib/seo";
import { xmlEscape, xmlResponse } from "@/lib/xml";
export async function GET() {
  const [posts, categories, tags, pages] = await Promise.all([
    prisma.post.count({ where: indexablePosts() }),
    indexableTerms("category"),
    indexableTerms("tag"),
    prisma.page.count({ where: { status: "PUBLISHED" } }),
  ]);
  const groups = [
    { name: "posts", count: posts },
    { name: "categories", count: categories.length },
    { name: "tags", count: tags.length },
    { name: "pages", count: pages + 2 },
  ];
  return xmlResponse(
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      groups
        .flatMap((group) =>
          Array.from(
            { length: Math.max(1, Math.ceil(group.count / 45000)) },
            (_, page) =>
              `<sitemap><loc>${xmlEscape(absoluteUrl(`/sitemaps/${group.name}-${page}.xml`))}</loc></sitemap>`,
          ),
        )
        .join("") +
      "</sitemapindex>",
  );
}
