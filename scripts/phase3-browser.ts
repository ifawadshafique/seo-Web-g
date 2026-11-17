import "dotenv/config";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { sealToken, token, digest } from "../src/lib/security";
import { defaultSlots } from "../src/lib/ad-policy";
if (new URL(process.env.DATABASE_URL!).pathname !== "/seo_phase3_test")
  throw new Error("Use seo_phase3_test");
const origin = process.env.SITE_URL!;
const basic =
  "Basic " + Buffer.from(process.env.STAGING_BASIC_AUTH!).toString("base64");
async function main() {
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "phase3-admin@example.com" },
  });
  const value = token();
  await prisma.session.create({
    data: {
      id: digest(value),
      userId: admin.id,
      version: 0,
      mfaVerified: true,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const cookie = await sealToken(value);
  const config = {
    ads_mode: "placeholder",
    publisher_id: "pub-0000000000000000",
    cookiebot_id: "123e4567-e89b-42d3-a456-426614174000",
    ga4_id: "G-TEST1234",
    slots: defaultSlots.map((slot) => ({
      ...slot,
      enabled: true,
      slotId: "1234567890",
    })),
  };
  async function save(data: unknown) {
    const response = await fetch(origin + "/api/admin/ads", {
      method: "POST",
      headers: {
        Authorization: basic,
        Origin: origin,
        Cookie: "seo_session=" + encodeURIComponent(cookie),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    assert.equal(response.status, 200, await response.text());
  }
  await save({ ...config, cookiebot_id: "", ga4_id: "" });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const serverOnly = await browser.newContext({
      httpCredentials: { username: "phase3", password: "local-test-only" },
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const serverPage = await serverOnly.newPage();
    for (const path of ["/", "/engineering-role-1"]) {
      await serverPage.goto(origin + path);
      assert.ok(
        await serverPage.locator("h1").isVisible(),
        `${path}: content must paint without JavaScript`,
      );
      assert.equal(await serverPage.locator(".public-loading").count(), 0);
      assert.ok(await serverPage.locator(".post-card").first().isVisible());
    }
    const featured = serverPage.locator("img.detail-image");
    assert.match(
      (await featured.getAttribute("src")) ?? "",
      /^\/_next\/image\?/,
    );
    assert.ok(await featured.getAttribute("srcset"));
    await featured.evaluate((image) => {
      if (
        !(image instanceof HTMLImageElement) ||
        !image.complete ||
        !image.naturalWidth
      )
        throw new Error(
          "Server-rendered optimized featured image did not load",
        );
    });
    await serverOnly.close();
    const context = await browser.newContext({
      httpCredentials: { username: "phase3", password: "local-test-only" },
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin + "/engineering-role-1");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Copy link", exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelector("[data-copy-status]")?.textContent ===
        "Link copied",
    );
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      origin + "/engineering-role-1",
    );
    await page.evaluate(`Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => { throw new Error("Clipboard unavailable"); } }
    })`);
    await page.getByRole("button", { name: "Copy link", exact: true }).click();
    await page.waitForFunction(() =>
      document.querySelector("[data-copy-fallback]")?.hasAttribute("open"),
    );
    assert.equal(
      await page.locator("[data-copy-fallback] input").inputValue(),
      origin + "/engineering-role-1",
    );
    await page.locator('[data-ad-placement="header"]').waitFor();
    const sizes = await page
      .locator('[data-ad-placement="header"] .ad-reserved')
      .boundingBox();
    assert.equal(Math.round(sizes!.height), 100);
    assert.ok(sizes!.width <= 320);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.screenshot({
      path: ".local/phase3-mobile-ads.png",
      fullPage: false,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(origin + "/engineering-role-1");
    try {
      await page
        .locator('[data-ad-placement="sidebar"]')
        .waitFor({ state: "visible", timeout: 5000 });
    } catch (error) {
      console.log(
        "Sidebar state:",
        await page.locator(".ad-sidebar").evaluate((element) => ({
          html: element.innerHTML,
          display: getComputedStyle(element).display,
          width: element.getBoundingClientRect().width,
          viewport: innerWidth,
        })),
      );
      throw error;
    }
    // Certified-provider SDK behavior is simulated in the browser; no Google ad or analytics network is contacted.
    const requests: string[] = [];
    await context.route("https://consent.cookiebot.com/**", async (route) => {
      requests.push("cmp");
      await route.fulfill({
        contentType: "application/javascript",
        body: `window.Cookiebot={consent:{statistics:false,marketing:false},renew:function(){}};window.__tcfapi=function(command,version,callback){window.__testTcfCallback=callback;callback({gdprApplies:true,eventStatus:'tcloaded',tcString:'test',purpose:{consents:{'1':false}},vendor:{consents:{'755':false}}},true);};window.dispatchEvent(new Event('CookiebotOnConsentReady'));`,
      });
    });
    await context.route(
      "https://www.googletagmanager.com/**",
      async (route) => {
        requests.push("analytics");
        await route.fulfill({
          contentType: "application/javascript",
          body: "window.__testAnalyticsLoaded=true;",
        });
      },
    );
    await context.route(
      "https://pagead2.googlesyndication.com/**",
      async (route) => {
        requests.push("ads");
        await route.fulfill({
          contentType: "application/javascript",
          body: "window.adsbygoogle=window.adsbygoogle||[];window.__testAdsLoaded=true;",
        });
      },
    );
    await save({ ...config, ads_mode: "live" });
    await page.goto(origin + "/engineering-role-1");
    await page.waitForFunction(() => !!window.Cookiebot);
    await page.waitForTimeout(300);
    assert.ok(requests.includes("cmp"));
    assert.ok(!requests.includes("analytics"));
    assert.ok(!requests.includes("ads"));
    await page.evaluate(() => {
      window.Cookiebot!.consent = { statistics: true, marketing: true };
      (
        window as unknown as {
          __testTcfCallback: (data: unknown, success: boolean) => void;
        }
      ).__testTcfCallback(
        {
          gdprApplies: true,
          eventStatus: "useractioncomplete",
          tcString: "test-consent",
          purpose: { consents: { "1": true } },
          vendor: { consents: { "755": true } },
        },
        true,
      );
      window.dispatchEvent(new Event("CookiebotOnAccept"));
    });
    await page.waitForFunction(
      () =>
        (window as unknown as { __testAnalyticsLoaded?: boolean })
          .__testAnalyticsLoaded === true &&
        (window as unknown as { __testAdsLoaded?: boolean }).__testAdsLoaded ===
          true,
    );
    assert.ok(requests.includes("analytics"));
    assert.ok(requests.includes("ads"));
    const gtagEvents = await page.evaluate(() => window.dataLayer);
    assert.ok(JSON.stringify(gtagEvents).includes("page_view"));
    // Admin sessions suppress both ad and consent SDK loading, even on public content.
    requests.length = 0;
    await context.addCookies([
      { name: "seo_session", value: cookie, url: origin, httpOnly: true },
    ]);
    await page.goto(origin + "/engineering-role-1");
    await page.waitForTimeout(200);
    assert.equal(await page.locator("[data-ad-placement]").count(), 0);
    assert.deepEqual(requests, []);
    await context.clearCookies();
    await save({
      ...config,
      ads_mode: "placeholder",
      cookiebot_id: "",
      ga4_id: "",
    });
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin + "/");
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
    // Production-mode metadata uses a separate server and rejects placeholder delivery.
    const prod = "http://localhost:3104";
    const robots = await (await fetch(prod + "/robots.txt")).text();
    assert.ok(robots.includes("Allow: /"));
    assert.ok(!robots.includes("Disallow: /search"));
    const thick = await (await fetch(prod + "/tag/engineering")).text();
    assert.ok(thick.includes('content="index, follow"'));
    const thin = await (await fetch(prod + "/tag/thin")).text();
    assert.ok(thin.includes('content="noindex, follow"'));
    const prodPage = await (await fetch(prod + "/engineering-role-1")).text();
    assert.ok(!prodPage.includes('data-ad-mode="placeholder"'));
    assert.deepEqual(errors, []);
    console.log(
      "PASS: staged responsive placeholders, consent-denied network gating, TCF/consent-granted loading, admin suppression, mobile layouts, production indexation rules, and production placeholder guard.",
    );
    await context.close();
  } finally {
    await browser.close();
    await prisma.session.deleteMany({ where: { id: digest(value) } });
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
