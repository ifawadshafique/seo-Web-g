import { createHash, timingSafeEqual } from "node:crypto";

export function validCronSecret(
  headers: Headers,
  secret = process.env.CRON_SECRET,
) {
  const authorization = headers.get("authorization");
  const supplied =
    headers.get("x-cron-secret") ??
    (authorization?.startsWith("Bearer ") ? authorization.slice(7) : null);
  if (!secret || !supplied) return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(supplied), hash(secret));
}

// Only this endpoint may pass staging's Basic gate using a worker credential.
export function authenticatedCronRequest(request: Request) {
  return (
    request.method === "GET" &&
    new URL(request.url).pathname === "/api/cron" &&
    validCronSecret(request.headers)
  );
}
