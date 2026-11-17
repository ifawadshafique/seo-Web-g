import { z } from "zod";

/**
 * Server-side environment validation (ENV-1, ENV-6).
 * Fails fast at startup if configuration is missing or unsafe.
 */
const schema = z
  .object({
    APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
    DATABASE_URL: z.string().url(),
    SITE_URL: z.string().url().default("http://localhost:3000"),
    SITE_TIMEZONE: z.string().default("Asia/Karachi"),
    // AD-14: off | placeholder | live
    ADS_MODE: z.enum(["off", "placeholder", "live"]).default("off"),
    ADSENSE_PUBLISHER_ID: z
      .string()
      .regex(/^pub-\d{10,20}$/, "Expected format pub-XXXXXXXXXXXXXXXX")
      .optional(),
  })
  .superRefine((env, ctx) => {
    // AD-14: placeholder mode is blocked in production.
    if (env.APP_ENV === "production" && env.ADS_MODE === "placeholder") {
      ctx.addIssue({
        code: "custom",
        path: ["ADS_MODE"],
        message: "ADS_MODE=placeholder is not allowed in production",
      });
    }
    // AD-14: live mode requires a publisher ID (needed for ads.txt).
    if (env.ADS_MODE === "live" && !env.ADSENSE_PUBLISHER_ID) {
      ctx.addIssue({
        code: "custom",
        path: ["ADSENSE_PUBLISHER_ID"],
        message: "ADS_MODE=live requires ADSENSE_PUBLISHER_ID",
      });
    }
    try {
      new Intl.DateTimeFormat("en", { timeZone: env.SITE_TIMEZONE });
    } catch {
      ctx.addIssue({
        code: "custom",
        path: ["SITE_TIMEZONE"],
        message: "Invalid IANA timezone",
      });
    }
  });

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

let cached: Env | undefined;

export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** ENV-2: only production is indexable. */
export function isIndexable(e: Pick<Env, "APP_ENV"> = env()): boolean {
  return e.APP_ENV === "production";
}
