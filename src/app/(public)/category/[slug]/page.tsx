import { pageMetadata, paginationPath } from "@/lib/seo";
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
  const term = await prisma.category.findUnique({ where: { slug } });
  const paging = paginationPath("/category/" + slug, query);
  const enough = true;
  return pageMetadata({
    title:
      (term?.name ?? "Not found") +
      (paging.page > 1 ? ` – Page ${paging.page}` : ""),
    description: term?.description ?? "",
    path: paging.path,
    index: !!term && enough && !query.q && !query.country && !query.tag,
  });
}
export default async function Page({ params, searchParams }: Props) {
  await connection();
  const { slug } = await params;
  const term = await prisma.category.findUnique({ where: { slug } });
  if (!term) notFound();
  return (
    <Listing
      params={await searchParams}
      scope={{ category: slug }}
      title={term.name}
      intro={term.description}
      path={`/category/${slug}`}
    />
  );
}
