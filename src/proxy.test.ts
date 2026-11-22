import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextFetchEvent } from "next/server";
vi.mock("./lib/prisma", () => ({ default: {} }));
vi.mock("./lib/csp-audit", () => ({
  effectiveCspMode: async () => "report-only",
  observeCsp: async () => {},
}));
import { proxy } from "./proxy";
const event = () => ({ waitUntil: vi.fn() }) as unknown as NextFetchEvent;
function request(url: string, protocol = "https") {
  return new NextRequest(url, {
    headers: { host: new URL(url).host, "x-forwarded-proto": protocol },
  });
}
afterEach(() => vi.unstubAllEnvs());
function setup() {
  vi.stubEnv("APP_ENV", "staging");
  vi.stubEnv("STAGING_PUBLIC_ACCESS", "true");
  vi.stubEnv("STAGING_BASIC_AUTH", "");
  vi.stubEnv("SITE_URL", "https://jobs.example");
  vi.stubEnv("TRUST_PROXY", "true");
}
describe("public website domain redirects", () => {
  it("redirects old addresses to the configured host while preserving path and query", async () => {
    setup();
    const response = await proxy(
      request("https://old.example/login?next=%2Fadmin"),
      event(),
    );
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://jobs.example/login?next=%2Fadmin",
    );
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });
  it("serves the selected HTTPS host without a redirect loop and upgrades HTTP", async () => {
    setup();
    const response = await proxy(
      request("https://jobs.example/login"),
      event(),
    );
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    const insecure = await proxy(
      request("http://jobs.example/login", "http"),
      event(),
    );
    expect(insecure.status).toBe(301);
    expect(insecure.headers.get("location")).toBe("https://jobs.example/login");
  });
  it("keeps protected staging gated and preserves production canonical redirects", async () => {
    setup();
    vi.stubEnv("STAGING_PUBLIC_ACCESS", "false");
    vi.stubEnv("STAGING_BASIC_AUTH", "stage:private-test-password");
    expect(
      (await proxy(request("https://old.example/login"), event())).status,
    ).toBe(401);
    vi.stubEnv("APP_ENV", "production");
    const production = await proxy(
      request("https://old.example/login"),
      event(),
    );
    expect(production.status).toBe(301);
    expect(production.headers.get("location")).toBe(
      "https://jobs.example/login",
    );
  });
});
