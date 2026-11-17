import { createHmac, timingSafeEqual } from "node:crypto";
export function imageUrl(path: string) {
  if (
    process.env.APP_ENV !== "staging" ||
    !process.env.STAGING_BASIC_AUTH ||
    !process.env.AUTH_ENCRYPTION_KEY ||
    !/^\/api\/media\/[a-f0-9-]{36}\.webp$/.test(path)
  )
    return path;
  const expires = String(Math.floor(Date.now() / 3600000) * 3600 + 7200);
  const signature = createHmac("sha256", process.env.AUTH_ENCRYPTION_KEY)
    .update(path + ":" + expires)
    .digest("hex");
  return path + "?" + new URLSearchParams({ expires, signature });
}
export function authorizedImageSource(path: string, params: URLSearchParams) {
  const signature = params.get("signature") ?? "",
    expires = Number(params.get("expires"));
  const now = Date.now() / 1000;
  if (
    !process.env.AUTH_ENCRYPTION_KEY ||
    !/^\/api\/media\/[a-f0-9-]{36}\.webp$/.test(path) ||
    !Number.isInteger(expires) ||
    expires < now ||
    expires > now + 7200 ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return false;
  const expected = createHmac("sha256", process.env.AUTH_ENCRYPTION_KEY)
    .update(path + ":" + String(expires))
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
