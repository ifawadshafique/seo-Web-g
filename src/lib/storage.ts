import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { get, put } from "@vercel/blob";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
const local = () => process.env.APP_ENV === "local";
const s3 = () =>
  new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  });
export async function storeImage(key: string, buffer: Buffer) {
  if (local()) {
    await mkdir(join(process.cwd(), ".local/uploads"), { recursive: true });
    await writeFile(join(process.cwd(), ".local/uploads", key), buffer, {
      flag: "wx",
    });
  } else {
    if (process.env.MEDIA_STORAGE === "vercel-blob") {
      await put(`media/${key}`, buffer, {
        access: "private",
        token: process.env.BLOB_READ_WRITE_TOKEN,
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "image/webp",
      });
      return;
    }
    if (!process.env.S3_BUCKET)
      throw new Error("Object storage is not configured");
    await s3().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: "image/webp",
      }),
    );
  }
}
export async function loadImage(key: string) {
  if (local()) return readFile(join(process.cwd(), ".local/uploads", key));
  if (process.env.MEDIA_STORAGE === "vercel-blob") {
    const result = await get(`media/${key}`, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (!result || result.statusCode !== 200) throw new Error("Not found");
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }
  if (!process.env.S3_BUCKET)
    throw new Error("Object storage is not configured");
  const object = await s3().send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
  );
  if (!object.Body) throw new Error("Not found");
  return Buffer.from(await object.Body.transformToByteArray());
}
