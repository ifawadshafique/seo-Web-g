import { describe, expect, it } from "vitest";
import { isIndexable, parseEnv } from "./env";

const base = { DATABASE_URL: "postgresql://u:p@localhost:5432/db" };

describe("parseEnv", () => {
  it("applies safe defaults", () => {
    const e = parseEnv(base);
    expect(e.APP_ENV).toBe("local");
    expect(e.ADS_MODE).toBe("off");
    expect(e.SITE_TIMEZONE).toBe("Asia/Karachi");
  });

  it("blocks placeholder ads in production (AD-14)", () => {
    expect(() =>
      parseEnv({ ...base, APP_ENV: "production", ADS_MODE: "placeholder" }),
    ).toThrow(/placeholder is not allowed/);
  });

  it("allows placeholder ads on staging", () => {
    expect(
      parseEnv({ ...base, APP_ENV: "staging", ADS_MODE: "placeholder" })
        .ADS_MODE,
    ).toBe("placeholder");
  });

  it("requires a publisher ID for live ads (AD-14)", () => {
    expect(() => parseEnv({ ...base, ADS_MODE: "live" })).toThrow(
      /requires ADSENSE_PUBLISHER_ID/,
    );
    expect(
      parseEnv({
        ...base,
        ADS_MODE: "live",
        ADSENSE_PUBLISHER_ID: "pub-1234567890123456",
      }).ADS_MODE,
    ).toBe("live");
  });

  it("rejects an invalid timezone", () => {
    expect(() => parseEnv({ ...base, SITE_TIMEZONE: "Mars/Olympus" })).toThrow(
      /Invalid IANA timezone/,
    );
  });

  it("requires DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});

describe("isIndexable (ENV-2)", () => {
  it("only production is indexable", () => {
    expect(isIndexable({ APP_ENV: "production" })).toBe(true);
    expect(isIndexable({ APP_ENV: "staging" })).toBe(false);
    expect(isIndexable({ APP_ENV: "local" })).toBe(false);
  });
});
