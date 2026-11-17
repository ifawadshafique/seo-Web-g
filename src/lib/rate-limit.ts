import { createHmac } from "node:crypto";
import prisma from "./prisma";
export async function publicRateLimit(
  request: Request,
  prefix: string,
  limit: number,
  periodMs: number,
) {
  const ip =
    process.env.TRUST_PROXY === "true"
      ? (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown")
      : "local";
  const now = Date.now();
  const key = createHmac(
    "sha256",
    process.env.AUTH_ENCRYPTION_KEY ?? "local-no-key",
  )
    .update(`${prefix}:${ip}:${Math.floor(now / periodMs)}`)
    .digest("hex");
  const bucket = await prisma.loginBucket.upsert({
    where: { key },
    create: { key, expiresAt: new Date(now + periodMs) },
    update: { count: { increment: 1 } },
  });
  return bucket.count <= limit;
}
