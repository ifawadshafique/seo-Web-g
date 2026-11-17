import { createHash } from "node:crypto";
export function cspPolicy(
  nonce: string,
  source: Record<string, string | undefined> = process.env,
) {
  const dev = source.NODE_ENV === "development";
  const secure = (source.SITE_URL ?? "").startsWith("https://");
  return (
    [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ""} https://consent.cookiebot.com https://consentcdn.cookiebot.com https://www.googletagmanager.com https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://www.google.com https://www.gstatic.com`,
      "script-src-attr 'none'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://consentcdn.cookiebot.com",
      "font-src 'self'",
      "connect-src 'self' https://consent.cookiebot.com https://consentcdn.cookiebot.com https://*.google-analytics.com https://analytics.google.com https://*.googlesyndication.com https://*.doubleclick.net https://www.google.com",
      "frame-src https://consent.cookiebot.com https://consentcdn.cookiebot.com https://*.googlesyndication.com https://*.doubleclick.net https://www.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "report-uri /api/security/csp-report",
      ...(dev ? ["connect-src-replace"] : []),
      ...(secure ? ["upgrade-insecure-requests"] : []),
    ]
      .filter((item) => item !== "connect-src-replace")
      .map((item) =>
        dev && item.startsWith("connect-src ") ? item + " ws: wss:" : item,
      )
      .join("; ") + ";"
  );
}
export const normalizedPolicy = (value: string) =>
  value
    .replace(/'nonce-[^']+'/g, "'nonce-NONCE'")
    .replace(/\s+/g, " ")
    .trim();
export const policyHash = (value: string) =>
  createHash("sha256").update(normalizedPolicy(value)).digest("hex");
export function stagingEvidenceValid(value: string | undefined, hash: string) {
  try {
    const record = JSON.parse(value ?? "{}");
    return (
      record.environment === "staging" &&
      record.policyHash === hash &&
      record.unreviewedViolations === 0 &&
      Date.parse(record.reviewedAt) - Date.parse(record.startedAt) >=
        7 * 86400000 &&
      Date.parse(record.lastSeenAt) >=
        Date.parse(record.reviewedAt) - 10 * 60000 &&
      Date.parse(record.reviewedAt) <= Date.now()
    );
  } catch {
    return false;
  }
}
