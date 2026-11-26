export function publicIndexingEnabled() {
  return (
    process.env.APP_ENV === "production" ||
    (process.env.APP_ENV === "staging" &&
      process.env.VERCEL_ENV === "production" &&
      process.env.STAGING_PUBLIC_ACCESS === "true" &&
      process.env.SITE_INDEXING_ENABLED === "true")
  );
}
