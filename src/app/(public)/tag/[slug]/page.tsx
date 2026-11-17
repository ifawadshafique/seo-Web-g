import { wordCount } from "@/lib/content-validation";
import { pageMetadata, paginationPath } from "@/lib/seo";
import { indexablePosts, tagThreshold } from "@/lib/indexing";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { Listing } from "@/components/listing";
import { SearchParams } from "@/lib/browse";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
};
export async function generateMetadata({ params, searchParams }: Props) {
  await connection();
  const { slug } = await params;
  const query = await searchParams;
  const term = await prisma.tag.findUnique({ where: { slug } });
  const paging = paginationPath("/tag/" + slug, query);
  const enough =
    (await prisma.post.count({
      where: { ...indexablePosts(), tags: { some: { tag: { slug } } } },
    })) >= (await tagThreshold());
  return pageMetadata({
    title:
      (term?.name ?? "Not found") +
      (paging.page > 1 ? ` – Page ${paging.page}` : ""),
    description: term?.description ?? "",
    path: paging.path,
    index:
      !!term &&
      wordCount(term.description ?? "") >= 150 &&
      enough &&
      !query.q &&
      !query.country &&
      !query.tag,
  });
}
export default async function Page({ params, searchParams }: Props) {
  await connection();
  const { slug } = await params;
  const term = await prisma.tag.findUnique({ where: { slug } });
  if (!term) notFound();
  return (
    <Listing
      params={await searchParams}
      scope={{ tag: slug }}
      title={term.name}
      intro={term.description}
      path={`/tag/${slug}`}
    />
  );
}
