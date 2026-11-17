import { headers } from "next/headers";
import { serializeJsonLd } from "@/lib/seo";
export async function JsonLd({ value }: { value: unknown }) {
  if (!value) return null;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(value) }}
    />
  );
}
