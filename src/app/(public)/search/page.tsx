import { pageMetadata } from "@/lib/seo";
import { connection } from "next/server";
import { Listing } from "@/components/listing";
import { SearchParams } from "@/lib/browse";
import { ui } from "@/lib/ui-text";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await connection();
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["q", "country", "tag", "page"])
    if (typeof query[key] === "string" && query[key])
      params.set(key, query[key]);
  const title =
    typeof query.q === "string" && query.q
      ? "Search: " + query.q
      : "Search jobs and articles";
  return pageMetadata({
    title,
    description:
      "Search the latest opportunities and career articles by keyword, country, or job type.",
    path: "/search" + (params.size ? "?" + params : ""),
    index: false,
  });
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await connection();
  return (
    <Listing params={await searchParams} title={ui.search} path="/search" />
  );
}
