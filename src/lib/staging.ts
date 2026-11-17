export function stagingProblems(source: Record<string, string | undefined>) {
  const problems: string[] = [];
  if (source.APP_ENV !== "staging") problems.push("APP_ENV must be staging");
  const httpsOrigin = (value: string | undefined) => {
    try {
      const url = new URL(value ?? "");
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash
      );
    } catch {
      return false;
    }
  };
  if (!httpsOrigin(source.SITE_URL))
    problems.push("SITE_URL must be the fixed HTTPS staging origin");
  try {
    const database = new URL(source.DATABASE_URL ?? "");
    if (
      !["postgres:", "postgresql:"].includes(database.protocol) ||
      ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) ||
      database.pathname.length < 2
    )
      problems.push(
        "DATABASE_URL must identify a separate managed staging PostgreSQL database",
      );
    if (
      !["require", "verify-ca", "verify-full"].includes(
        database.searchParams.get("sslmode") ?? "",
      )
    )
      problems.push(
        "DATABASE_URL must require TLS (sslmode=require or stronger)",
      );
    if (database.hostname.includes("-pooler.") && !source.DIRECT_URL)
      problems.push(
        "DIRECT_URL is required for migrations when DATABASE_URL is pooled",
      );
    if (source.DIRECT_URL) {
      const direct = new URL(source.DIRECT_URL);
      if (
        !["postgres:", "postgresql:"].includes(direct.protocol) ||
        direct.hostname.includes("-pooler.") ||
        direct.pathname !== database.pathname ||
        !["require", "verify-ca", "verify-full"].includes(
          direct.searchParams.get("sslmode") ?? "",
        )
      )
        problems.push(
          "DIRECT_URL must be an unpooled TLS connection to the same staging database",
        );
      if (
        database.hostname.endsWith(".neon.tech") &&
        direct.hostname !== database.hostname.replace("-pooler.", ".")
      )
        problems.push(
          "DIRECT_URL must target the same Neon endpoint as DATABASE_URL",
        );
    }
  } catch {
    problems.push("DATABASE_URL or DIRECT_URL is missing or invalid");
  }
  if (!/^[a-f0-9]{64}$/i.test(source.AUTH_ENCRYPTION_KEY ?? ""))
    problems.push("AUTH_ENCRYPTION_KEY must be a new 32-byte staging key");
  const basic = source.STAGING_BASIC_AUTH ?? "";
  const separator = basic.indexOf(":");
  if (
    separator < 1 ||
    basic.length - separator - 1 < 24 ||
    /[\r\n]/.test(basic)
  )
    problems.push(
      "STAGING_BASIC_AUTH needs a username and a generated password of at least 24 characters",
    );
  if (
    (source.CRON_SECRET?.length ?? 0) < 32 ||
    /[\r\n]/.test(source.CRON_SECRET ?? "")
  )
    problems.push("CRON_SECRET must have at least 32 characters");
  if (source.LOCAL_AUTH_SKIP_MFA !== "false")
    problems.push("LOCAL_AUTH_SKIP_MFA must be false");
  if (source.CSP_MODE !== "report-only")
    problems.push(
      "CSP_MODE must be report-only during initial staging observation",
    );
  if (!["off", "placeholder"].includes(source.ADS_MODE ?? ""))
    problems.push("ADS_MODE must be off or placeholder");
  if (source.ADSENSE_APPROVED !== "false")
    problems.push("ADSENSE_APPROVED must remain false");
  if (source.TRUST_PROXY !== "true")
    problems.push("TRUST_PROXY must be true behind Vercel's proxy");
  if (source.MEDIA_STORAGE === "vercel-blob") {
    if (!source.BLOB_READ_WRITE_TOKEN)
      problems.push(
        "BLOB_READ_WRITE_TOKEN is required for private image storage",
      );
  } else
    for (const key of [
      "S3_BUCKET",
      "S3_REGION",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
    ])
      if (!source[key])
        problems.push(`${key} is required for durable staging image storage`);
  if (source.S3_ENDPOINT && !httpsOrigin(source.S3_ENDPOINT))
    problems.push(
      "S3_ENDPOINT must use HTTPS without credentials, query or path",
    );
  return problems;
}
