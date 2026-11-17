import { AdPlacement } from "@/components/ad-placement";
import { pageMetadata, absoluteUrl } from "@/lib/seo";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { postInclude, publicWhere } from "@/lib/publishing";
import { PostView } from "@/components/post-view";
import { PostCard } from "@/components/post-card";
import { cleanBody } from "@/lib/content-validation";
import { siteSettings } from "@/lib/settings";
import { ui } from "@/lib/ui-text";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  await connection();
  const { slug } = await params;
  const post = await prisma.post.findFirst({
    where: { ...publicWhere(), slug },
    include: { ogMedia: true, featuredMedia: true },
  });
  if (post)
    return pageMetadata({
      title: post.metaTitle || post.title,
      description: post.metaDescription || post.excerpt || post.body,
      path: "/" + slug,
      index: !post.noindex,
      image: absoluteUrl("/api/og?post=" + encodeURIComponent(slug)),
    });
  const page = await prisma.page.findFirst({
    where: { slug, status: "PUBLISHED" },
  });
  return pageMetadata({
    title: page?.metaTitle || page?.title || "Page not found",
    description: page?.metaDesc || page?.body || "Page not found",
    path: "/" + slug,
    index: !!page,
  });
}
export default async function Page({ params }: Props) {
  await connection();
  const { slug } = await params;
  const post = await prisma.post.findFirst({
    where: { ...publicWhere(), slug },
    include: postInclude,
  });
  if (!post) {
    const page = await prisma.page.findFirst({
      where: { slug, status: "PUBLISHED" },
    });
    if (!page) notFound();
    return (
      <main className="public-main static-page">
        <nav className="breadcrumbs">
          <Link prefetch={false} href="/">
            {ui.home}
          </Link>
          <span>/</span>
          <span>{page.title}</span>
        </nav>
        <h1>{page.title}</h1>
        <div
          className="rich-content"
          dangerouslySetInnerHTML={{ __html: cleanBody(page.body) }}
        />
      </main>
    );
  }
  const settings = await siteSettings();
  const related = await prisma.post.findMany({
    where: {
      ...publicWhere(),
      id: { not: post.id },
      OR: [
        { categoryId: post.categoryId },
        {
          tags: {
            some: { tagId: { in: post.tags.map((link) => link.tagId) } },
          },
        },
      ],
    },
    include: postInclude,
    orderBy: { publishedAt: "desc" },
    take: 6,
  });
  return (
    <main className="public-main">
      <div className="post-layout">
        <PostView post={post} timezone={settings.site_timezone} />
        <aside className="ad-sidebar">
          <AdPlacement name="sidebar" />
        </aside>
      </div>
      {related.length > 0 && (
        <section className="related-posts">
          <h2>{ui.related}</h2>
          <div className="post-grid">
            {related.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
