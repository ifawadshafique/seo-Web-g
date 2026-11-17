import { pageMetadata, paginationPath, organizationSchema } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { connection } from "next/server";
import { Listing } from "@/components/listing";
import { SearchParams } from "@/lib/browse";
import { siteSettings } from "@/lib/settings";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await connection();
  const settings = await siteSettings();
  const paging = paginationPath("/", await searchParams);
  return pageMetadata({
    title:
      settings.site_name + (paging.page > 1 ? ` – Page ${paging.page}` : ""),
    description: settings.default_meta_description,
    path: paging.path,
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
      other: process.env.BING_SITE_VERIFICATION
        ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
        : undefined,
    },
  });
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await connection();
  const settings = await siteSettings();
  return (
    <>
      <JsonLd value={organizationSchema(settings.site_name, settings.logo)} />
      <Listing params={await searchParams} hero />
    </>
  );
}
