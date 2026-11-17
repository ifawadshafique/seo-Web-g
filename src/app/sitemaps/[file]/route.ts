export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { indexablePosts, indexableTerms } from "@/lib/indexing";
import { absoluteUrl } from "@/lib/seo";
import { xmlEscape, xmlResponse } from "@/lib/xml";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const match = /^(posts|categories|tags|pages)-(\d+)\.xml$/.exec(file);
  if (!match) return new Response(null, { status: 404 });
  const group = match[1],
    page = Number(match[2]);
  if (!Number.isSafeInteger(page) || page > 10000)
    return new Response(null, { status: 404 });
  const skip = page * 45000;
  let entries: { path: string; date?: Date }[] = [];
  if (group === "posts") {
    const posts = await prisma.post.findMany({
      where: indexablePosts(),
      orderBy: { id: "asc" },
      skip,
      take: 45000,
      select: { slug: true, updatedAt: true },
    });
    entries = posts.map((post) => ({
      path: "/" + post.slug,
      date: post.updatedAt,
    }));
  } else if (group === "categories" || group === "tags") {
    const terms = await indexableTerms(group === "tags" ? "tag" : "category");
    entries = terms.slice(skip, skip + 45000).map((term) => ({
      path: `/${group === "tags" ? "tag" : "category"}/${term.slug}`,
      date: term.lastmod,
    }));
  } else {
    const pages = await prisma.page.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { id: "asc" },
      select: { slug: true, updatedAt: true },
    });
    const latest = await prisma.post.aggregate({
      where: indexablePosts(),
      _max: { updatedAt: true },
    });
    const changed = await prisma.setting.aggregate({
      where: {
        key: {
          in: ["site_name", "default_meta_description", "logo", "social_links"],
        },
      },
      _max: { updatedAt: true },
    });
    const newest = [latest._max.updatedAt, changed._max.updatedAt]
      .filter((date): date is Date => !!date)
      .sort((a, b) => +b - +a)[0];
    entries = [
      { path: "/", date: newest },
      {
        path: "/contact",
        date: pages.find((page) => page.slug === "contact")?.updatedAt,
      },
      ...pages
        .filter((item) => item.slug !== "contact")
        .map((item) => ({ path: "/" + item.slug, date: item.updatedAt })),
    ].slice(skip, skip + 45000);
  }
  if (page > 0 && !entries.length) return new Response(null, { status: 404 });
  return xmlResponse(
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      entries
        .map(
          (entry) =>
            `<url><loc>${xmlEscape(absoluteUrl(entry.path))}</loc>${entry.date ? `<lastmod>${entry.date.toISOString()}</lastmod>` : ""}</url>`,
        )
        .join("") +
      "</urlset>",
  );
}
