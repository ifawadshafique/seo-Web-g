/** Build a credential-scoped request for the explicitly configured worker origin. */
export function workerRequest(source: Record<string, string | undefined> = process.env) {
  if (!source.CRON_SECRET) throw new Error("Configure CRON_SECRET");
  const origin = new URL(source.SITE_URL ?? "http://localhost:3000");
  if (
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    (origin.protocol !== "https:" &&
      !(
        source.APP_ENV === "local" &&
        origin.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
      ))
  )
    throw new Error("Configure a secure worker SITE_URL origin");
  const headers = new Headers({ "x-cron-secret": source.CRON_SECRET });
  if (source.STAGING_BASIC_AUTH)
    headers.set(
      "authorization",
      "Basic " + Buffer.from(source.STAGING_BASIC_AUTH).toString("base64"),
    );
  if (source.APP_ENV === "staging" && source.VERCEL_AUTOMATION_BYPASS_SECRET)
    headers.set(
      "x-vercel-protection-bypass",
      source.VERCEL_AUTOMATION_BYPASS_SECRET,
    );
  return {
    url: new URL("/api/cron", origin),
    options: {
      headers,
      redirect: "error" as const,
      signal: AbortSignal.timeout(60000),
    },
  };
}
