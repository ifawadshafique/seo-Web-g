/**
 * ENV-4: seed script for local and staging only. Never runs against production.
 * Phase 0 seeds only site settings; sample content is added once the
 * full schema lands in Phase 1.
 */
import { parseEnv } from "../src/lib/env";

export function assertSeedAllowed(appEnv: string, databaseUrl: string): void {
  if (appEnv === "production") {
    throw new Error("Refusing to seed: APP_ENV=production (ENV-4)");
  }
  if (/prod/i.test(databaseUrl)) {
    throw new Error("Refusing to seed: DATABASE_URL looks like production (ENV-4)");
  }
}

async function main() {
  const e = parseEnv(process.env);
  assertSeedAllowed(e.APP_ENV, e.DATABASE_URL);

  const { default: db } = await import("../src/lib/prisma");
  try {
    const settings: Record<string, string> = {
      site_name: "Job Posts (sample)",
      site_timezone: e.SITE_TIMEZONE,
      ads_mode: e.ADS_MODE,
      default_meta_description:
        "Sample site description used on local and staging environments only.",
    };
    for (const [key, value] of Object.entries(settings)) {
      await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
    console.log(`Seeded ${Object.keys(settings).length} settings (${e.APP_ENV}).`);
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1]?.endsWith("seed.ts")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
