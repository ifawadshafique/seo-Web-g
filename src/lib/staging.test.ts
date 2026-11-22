import { describe, expect, it } from "vitest";
import { stagingProblems } from "./staging";
const source = {
  APP_ENV: "staging",
  SITE_URL: "https://stage.example",
  DATABASE_URL:
    "postgresql://stage:private@database.example/staging?sslmode=require",
  AUTH_ENCRYPTION_KEY: "ab".repeat(32),
  STAGING_BASIC_AUTH: "stage:" + "x".repeat(32),
  CRON_SECRET: "y".repeat(48),
  LOCAL_AUTH_SKIP_MFA: "false",
  CSP_MODE: "report-only",
  ADS_MODE: "placeholder",
  ADSENSE_APPROVED: "false",
  TRUST_PROXY: "true",
  S3_BUCKET: "staging-images",
  S3_REGION: "auto",
  S3_ENDPOINT: "https://storage.example",
  AWS_ACCESS_KEY_ID: "test-key",
  AWS_SECRET_ACCESS_KEY: "private-test-key",
};
describe("staging deployment preflight", () => {
  it("permits explicitly selected public previews while retaining admin MFA and ads guards", () => {
    const publicPreview = {
      ...source,
      STAGING_PUBLIC_ACCESS: "true",
      STAGING_BASIC_AUTH: "",
      ADS_MODE: "off",
    };
    expect(stagingProblems(publicPreview)).toEqual([]);
    for (const change of [
      { STAGING_PUBLIC_ACCESS: "false" },
      { STAGING_PUBLIC_ACCESS: "yes" },
      { STAGING_BASIC_AUTH: "stage:private" },
      { LOCAL_AUTH_SKIP_MFA: "true" },
      { ADS_MODE: "placeholder" },
      { ADS_MODE: "live" },
    ])
      expect(
        stagingProblems({ ...publicPreview, ...change }).length,
      ).toBeGreaterThan(0);
  });
  it("requires a matching unpooled migration connection for Neon pooling", () => {
    const pooled = {
      ...source,
      DATABASE_URL:
        "postgresql://user:private@ep-stage-pooler.ap-southeast-1.aws.neon.tech/staging?sslmode=require",
    };
    expect(stagingProblems(pooled)).toContain(
      "DIRECT_URL is required for migrations when DATABASE_URL is pooled",
    );
    expect(
      stagingProblems({
        ...pooled,
        DIRECT_URL:
          "postgresql://user:private@ep-stage.ap-southeast-1.aws.neon.tech/staging?sslmode=verify-full",
      }),
    ).toEqual([]);
    expect(
      stagingProblems({
        ...pooled,
        DIRECT_URL:
          "postgresql://user:private@ep-other.ap-southeast-1.aws.neon.tech/staging?sslmode=require",
      }),
    ).toContain(
      "DIRECT_URL must target the same Neon endpoint as DATABASE_URL",
    );
  });
  it("accepts private Vercel Blob without AWS credentials", () => {
    expect(
      stagingProblems({
        ...source,
        MEDIA_STORAGE: "vercel-blob",
        BLOB_READ_WRITE_TOKEN: "test-private-token",
        S3_BUCKET: "",
        AWS_ACCESS_KEY_ID: "",
        AWS_SECRET_ACCESS_KEY: "",
      }),
    ).toEqual([]);
    expect(
      stagingProblems({
        ...source,
        MEDIA_STORAGE: "vercel-blob",
        BLOB_READ_WRITE_TOKEN: "",
      }),
    ).toContain("BLOB_READ_WRITE_TOKEN is required for private image storage");
  });
  it("accepts isolated protected staging configuration", () =>
    expect(stagingProblems(source)).toEqual([]));
  it("rejects local databases, missing TLS and bypassed authentication before migrations", () => {
    for (const change of [
      { APP_ENV: "local" },
      {
        DATABASE_URL:
          "postgresql://user:private@localhost/staging?sslmode=require",
      },
      { DATABASE_URL: "postgresql://user:private@database.example/staging" },
      { LOCAL_AUTH_SKIP_MFA: "true" },
      { STAGING_BASIC_AUTH: "stage:short" },
      { SITE_URL: "http://stage.example" },
      { SITE_URL: "https://user:private@stage.example" },
    ])
      expect(stagingProblems({ ...source, ...change }).length).toBeGreaterThan(
        0,
      );
  });
  it("rejects live ads, premature CSP enforcement and ephemeral image storage", () => {
    for (const change of [
      { ADS_MODE: "live" },
      { ADSENSE_APPROVED: "true" },
      { CSP_MODE: "enforce" },
      { S3_BUCKET: "" },
      { S3_ENDPOINT: "http://storage.example" },
    ])
      expect(stagingProblems({ ...source, ...change }).length).toBeGreaterThan(
        0,
      );
  });
  it("reports configuration keys without disclosing credentials", () => {
    const problems = stagingProblems({
      ...source,
      DATABASE_URL: "secret-password",
      AUTH_ENCRYPTION_KEY: "secret-key",
    }).join(" ");
    expect(problems).not.toContain("secret-password");
    expect(problems).not.toContain("secret-key");
  });
});
