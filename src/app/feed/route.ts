export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { indexablePosts } from "@/lib/indexing";
import { absoluteUrl } from "@/lib/seo";
import { siteSettings } from "@/lib/settings";
import { xmlEscape, xmlResponse } from "@/lib/xml";
import { plainText } from "@/lib/content-validation";
export async function GET() {
  const [settings, posts] = await Promise.all([
    siteSettings(),
    prisma.post.findMany({
      where: indexablePosts(),
      orderBy: { publishedAt: "desc" },
      take: 50,
      select: {
        title: true,
        slug: true,
        excerpt: true,
        body: true,
        publishedAt: true,
      },
    }),
  ]);
  return xmlResponse(
    '<rss version="2.0"><channel>' +
      `<title>${xmlEscape(settings.site_name)}</title><link>${xmlEscape(absoluteUrl("/"))}</link><description>${xmlEscape(settings.default_meta_description)}</description>` +
      posts
        .map(
          (post) =>
            `<item><title>${xmlEscape(post.title)}</title><link>${xmlEscape(absoluteUrl("/" + post.slug))}</link><guid isPermaLink="true">${xmlEscape(absoluteUrl("/" + post.slug))}</guid><description>${xmlEscape(post.excerpt || plainText(post.body).slice(0, 300))}</description><pubDate>${post.publishedAt!.toUTCString()}</pubDate></item>`,
        )
        .join("") +
      "</channel></rss>",
  );
}
