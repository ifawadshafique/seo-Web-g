import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const overrides = {
  APP_ENV: "staging",
  MEDIA_STORAGE: "vercel-blob",
  DATABASE_URL: "",
  SITE_URL: "",
  ADS_MODE: "placeholder",
  STAGING_BASIC_AUTH: "stage:" + randomBytes(24).toString("base64url"),
  AUTH_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  CRON_SECRET: randomBytes(32).toString("base64url"),
  TRUST_PROXY: "true",
  LOCAL_AUTH_SKIP_MFA: "false",
  CSP_MODE: "report-only",
  ADSENSE_APPROVED: "false",
};
const template = await readFile(".env.example", "utf8");
const output = template.replace(/^([A-Z_0-9]+)=(.*)$/gm, (line, key) =>
  key in overrides ? `${key}=${overrides[key]}` : line,
);
await mkdir(".local", { recursive: true });
try {
  await writeFile(".local/staging.env", output, { flag: "wx", mode: 0o600 });
  console.log(
    "Prepared private .local/staging.env with independent staging credentials. Configure the managed database, fixed hostname and durable image storage before deployment. No values were printed or uploaded.",
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log(
    "Kept existing .local/staging.env; staging credentials were not overwritten.",
  );
}
