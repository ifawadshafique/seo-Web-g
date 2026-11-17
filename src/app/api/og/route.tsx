export const dynamic = "force-dynamic";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import prisma from "@/lib/prisma";
import { publicWhere } from "@/lib/publishing";
import { siteSettings } from "@/lib/settings";
import { loadImage } from "@/lib/storage";
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("post");
  const settings = await siteSettings();
  let title = settings.site_name;
  if (slug) {
    const post = await prisma.post.findFirst({
      where: { ...publicWhere(), slug },
      include: { ogMedia: true, featuredMedia: true },
    });
    if (!post) return new Response(null, { status: 404 });
    title = post.title;
    const image = post.ogMedia ?? post.featuredMedia;
    if (image) {
      const key = /^\/api\/media\/([a-f0-9-]{36}\.webp)$/.exec(image.url)?.[1];
      if (key)
        try {
          const data = await sharp(await loadImage(key))
            .resize(1200, 630, { fit: "cover" })
            .png()
            .toBuffer();
          return new Response(new Uint8Array(data), {
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "no-store",
            },
          });
        } catch {
          /* Fall back to a generated card without revealing storage errors. */
        }
    }
  }
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: "#173c30",
        color: "#fff",
      }}
    >
      <div style={{ fontSize: 28, color: "#bed3c2", marginBottom: 30 }}>
        {settings.site_name}
      </div>
      <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.15 }}>
        {title.slice(0, 150)}
      </div>
      <div style={{ fontSize: 24, marginTop: 36, color: "#bed3c2" }}>
        Jobs and practical career guidance
      </div>
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": "no-store" } },
  );
}
