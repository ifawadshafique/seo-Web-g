import { expect, it } from "vitest";
import { workerRequest } from "./worker-request";
it("scopes staging credentials to the selected cron origin and refuses redirects", () => {
  const request = workerRequest({
    APP_ENV: "staging",
    SITE_URL: "https://stage.example",
    CRON_SECRET: "worker",
    STAGING_BASIC_AUTH: "user:password",
    VERCEL_AUTOMATION_BYPASS_SECRET: "platform",
  });
  expect(request.url.href).toBe("https://stage.example/api/cron");
  expect(request.options.redirect).toBe("error");
  expect(request.options.headers.get("x-cron-secret")).toBe("worker");
  expect(request.options.headers.get("x-vercel-protection-bypass")).toBe(
    "platform",
  );
  const production = workerRequest({
    APP_ENV: "production",
    SITE_URL: "https://public.example",
    CRON_SECRET: "worker",
    VERCEL_AUTOMATION_BYPASS_SECRET: "platform",
  });
  expect(production.options.headers.has("x-vercel-protection-bypass")).toBe(
    false,
  );
});
it("rejects insecure or ambiguous worker destinations", () => {
  for (const SITE_URL of [
    "http://remote.example",
    "https://user:password@remote.example",
    "https://remote.example/path",
    "https://remote.example?target=other",
    "https://remote.example/#secret",
  ]) {
    expect(() =>
      workerRequest({ APP_ENV: "staging", SITE_URL, CRON_SECRET: "worker" }),
    ).toThrow("secure worker SITE_URL");
  }
  expect(
    workerRequest({
      APP_ENV: "local",
      SITE_URL: "http://127.0.0.1:3000",
      CRON_SECRET: "worker",
    }).url.pathname,
  ).toBe("/api/cron");
});
