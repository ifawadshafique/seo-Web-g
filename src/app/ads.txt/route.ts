export const dynamic = "force-dynamic";
import { advertisingConfig } from "@/lib/advertising";
export async function GET() {
  const config = await advertisingConfig();
  if (!config.publisher_id)
    return new Response("", {
      status: 404,
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  return new Response(
    `google.com, ${config.publisher_id}, DIRECT, f08c47fec0942fa0\n`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
