import sharp from "sharp";
import prisma from "@/lib/prisma";
import { protectedRoute } from "@/lib/auth";
import { contentResult, ContentError } from "@/lib/api-error";
import { storeImage } from "@/lib/storage";
export async function GET(request: Request) {
  return protectedRoute(request, "content", async () =>
    Response.json(
      await prisma.media.findMany({ take: 100, orderBy: { id: "desc" } }),
    ),
  );
}
export async function POST(request: Request) {
  return protectedRoute(request, "content", (session) =>
    contentResult(async () => {
      const reader = request.body?.getReader();
      if (!reader) throw new ContentError("Upload an image");
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > 5 * 1024 * 1024 + 65536) {
          await reader.cancel();
          throw new ContentError("Image must be 5 MB or smaller");
        }
        chunks.push(value);
      }
      const bytes = Buffer.concat(chunks);
      const form = await new Request(request.url, {
        method: "POST",
        headers: { "Content-Type": request.headers.get("content-type") ?? "" },
        body: bytes,
      }).formData();
      const file = form.get("file");
      const alt = String(form.get("alt") ?? "").trim();
      if (
        !(file instanceof File) ||
        !alt ||
        alt.length > 500 ||
        file.size > 5 * 1024 * 1024
      )
        throw new ContentError(
          "Upload an image up to 5 MB with descriptive alt text",
        );
      let result;
      try {
        const image = sharp(Buffer.from(await file.arrayBuffer()), {
          limitInputPixels: 40_000_000,
          animated: false,
        });
        const metadata = await image.metadata();
        if (
          !["jpeg", "png", "webp", "avif"].includes(metadata.format ?? "") ||
          !metadata.width ||
          !metadata.height
        )
          throw new Error("Invalid image");
        result = await image
          .rotate()
          .resize({
            width: 1920,
            height: 1920,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 82 })
          .toBuffer({ resolveWithObject: true });
      } catch {
        throw new ContentError(
          "Use a valid JPEG, PNG, WebP, or AVIF image within 40 megapixels",
        );
      }
      const key = crypto.randomUUID() + ".webp";
      await storeImage(key, result.data);
      const media = await prisma.$transaction(async (tx) => {
        const saved = await tx.media.create({
          data: {
            url: `/api/media/${key}`,
            altText: alt,
            width: result.info.width,
            height: result.info.height,
            mimeType: "image/webp",
            sizeBytes: result.data.length,
            uploadedBy: session.user.id,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            action: "MEDIA_UPLOADED",
            entityType: "Media",
            entityId: saved.id,
          },
        });
        return saved;
      });
      return Response.json(media, { status: 201 });
    }),
  );
}
