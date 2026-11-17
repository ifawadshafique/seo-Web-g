import { describe, expect, it } from "vitest";
import { assertSeedAllowed } from "./seed";

describe("assertSeedAllowed (ENV-4)", () => {
  it("refuses production", () => {
    expect(() => assertSeedAllowed("production", "postgresql://x/db")).toThrow();
  });
  it("refuses a production-looking database URL", () => {
    expect(() => assertSeedAllowed("staging", "postgresql://x/seo_prod")).toThrow();
  });
  it("allows local and staging", () => {
    expect(() => assertSeedAllowed("local", "postgresql://x/seo_web_dev")).not.toThrow();
    expect(() => assertSeedAllowed("staging", "postgresql://x/seo_staging")).not.toThrow();
  });
});
