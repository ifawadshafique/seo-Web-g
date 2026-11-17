import "dotenv/config";
import lighthouse from "lighthouse";
import { computeMedianRun } from "lighthouse/core/lib/median-run.js";
import { launch } from "chrome-launcher";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
if (new URL(process.env.DATABASE_URL).pathname !== "/seo_phase3_test")
  throw new Error("Use seo_phase3_test");
async function main() {
  await mkdir(".local/lighthouse", { recursive: true });
  await prisma.adSlot.updateMany({ data: { enabled: true } });
  for (const [key, value] of Object.entries({ cookiebot_id: "", ga4_id: "" }))
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  const results = [];
  for (const mode of ["off", "placeholder"]) {
    await prisma.setting.upsert({
      where: { key: "ads_mode" },
      create: { key: "ads_mode", value: mode },
      update: { value: mode },
    });
    for (const path of ["/", "/engineering-role-1"]) {
      const chrome = await launch({
        chromePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
        chromeFlags: ["--headless", "--no-sandbox", "--disable-dev-shm-usage"],
      });
      try {
        const reports = [];
        const name = mode + (path === "/" ? "-list" : "-post");
        for (let sample = 1; sample <= 3; sample++) {
          const run = await lighthouse(process.env.SITE_URL + path, {
            port: chrome.port,
            output: "json",
            onlyCategories: ["performance", "accessibility"],
            logLevel: "error",
            extraHeaders: {
              Authorization:
                "Basic " +
                Buffer.from(process.env.STAGING_BASIC_AUTH).toString("base64"),
            },
          });
          if (!run) throw new Error("Lighthouse did not produce a report");
          const lhr = run.lhr;
          reports.push(lhr);
          // Reports may be shared as CI artifacts; never include the Basic credential.
          if (lhr.configSettings.extraHeaders)
            lhr.configSettings.extraHeaders = { Authorization: "[redacted]" };
          await writeFile(
            `.local/lighthouse/${name}-${sample}.json`,
            JSON.stringify(lhr, null, 2),
          );
          console.log(
            JSON.stringify({
              mode,
              path,
              sample,
              score: Math.round((lhr.categories.performance.score ?? 0) * 100),
              lcp: lhr.audits["largest-contentful-paint"].numericValue,
              cls: lhr.audits["cumulative-layout-shift"].numericValue,
              tbt: lhr.audits["total-blocking-time"].numericValue,
            }),
          );
        }
        const lhr = computeMedianRun(reports);
        const result = {
          mode,
          path,
          sample: reports.indexOf(lhr) + 1,
          score: Math.round((lhr.categories.performance.score ?? 0) * 100),
          lcp: lhr.audits["largest-contentful-paint"].numericValue ?? Infinity,
          cls: lhr.audits["cumulative-layout-shift"].numericValue ?? Infinity,
          tbt: lhr.audits["total-blocking-time"].numericValue ?? Infinity,
          accessibility: Math.round(
            (lhr.categories.accessibility.score ?? 0) * 100,
          ),
        };
        results.push(result);
        await writeFile(
          `.local/lighthouse/${name}.json`,
          JSON.stringify(lhr, null, 2),
        );
        console.log("Representative run: " + JSON.stringify(result));
      } finally {
        await chrome.kill();
      }
    }
  }
  await writeFile(
    ".local/lighthouse/summary.json",
    JSON.stringify(results, null, 2),
  );
  for (const { mode, path, score, lcp, cls, tbt } of results) {
    const name = mode + path;
    assert.ok(score >= 90, `${name}: performance below 90`);
    assert.ok(lcp <= 2500, `${name}: LCP above 2.5s`);
    assert.ok(cls <= 0.1, `${name}: CLS above 0.1`);
    assert.ok(tbt <= 200, `${name}: blocking time above 200ms`);
  }
  console.log(
    "PASS: mobile Lighthouse targets in ads-off and staging-placeholder modes on list and post pages.",
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
