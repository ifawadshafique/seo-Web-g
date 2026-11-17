import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticatedCronRequest, validCronSecret } from "./cron-auth";

afterEach(() => vi.unstubAllEnvs());
describe("protected staging scheduler", () => {
  it("accepts the Vercel Bearer credential and the local worker header", () => {
    expect(
      validCronSecret(
        new Headers({ authorization: "Bearer worker-secret" }),
        "worker-secret",
      ),
    ).toBe(true);
    expect(
      validCronSecret(
        new Headers({
          "x-cron-secret": "worker-secret",
          authorization: "Basic staging",
        }),
        "worker-secret",
      ),
    ).toBe(true);
  });
  it("rejects missing, incorrect, unprefixed and empty credentials", () => {
    for (const authorization of [
      "",
      "worker-secret",
      "Basic worker-secret",
      "Bearer wrong",
      "Bearer ",
    ])
      expect(
        validCronSecret(new Headers({ authorization }), "worker-secret"),
      ).toBe(false);
    expect(
      validCronSecret(
        new Headers({ authorization: "Bearer worker-secret" }),
        "",
      ),
    ).toBe(false);
  });
  it("never lets a worker credential bypass Basic auth for another path or method", () => {
    vi.stubEnv("CRON_SECRET", "worker-secret");
    const request = (path: string, method = "GET") =>
      new Request("https://stage.example" + path, {
        method,
        headers: { authorization: "Bearer worker-secret" },
      });
    expect(authenticatedCronRequest(request("/api/cron"))).toBe(true);
    for (const path of [
      "/",
      "/admin",
      "/api/admin/users",
      "/api/cron/other",
      "/api/cron/",
    ])
      expect(authenticatedCronRequest(request(path))).toBe(false);
    expect(authenticatedCronRequest(request("/api/cron", "POST"))).toBe(false);
  });
});
