import "dotenv/config";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { randomBytes, createHash } from "node:crypto";
import { sealData } from "iron-session";
const url = new URL(process.env.DATABASE_URL);
if (url.pathname !== "/seo_phase2_test")
  throw new Error("Use the disposable seo_phase2_test database");
const origin = process.env.SITE_URL ?? "http://localhost:3102";
const db = new Client({ connectionString: url.toString() });
await db.connect();
const user = await db.query('SELECT id FROM "User" WHERE email=$1', [
  "phase2-admin@example.com",
]);
if (!user.rowCount) throw new Error("Run the integration fixtures first");
await db.query('DELETE FROM "Post" WHERE title=$1', [
  "Browser publishing test",
]);
const token = randomBytes(32).toString("hex");
const id = createHash("sha256").update(token).digest("hex");
await db.query(
  'INSERT INTO "Session" (id,"userId",version,"mfaVerified","expiresAt") VALUES ($1,$2,0,true,$3)',
  [id, user.rows[0].id, new Date(Date.now() + 3600000)],
);
const cookie = await sealData(
  { token },
  { password: process.env.AUTH_ENCRYPTION_KEY, ttl: 43200 },
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies([
    {
      name: "seo_session",
      value: cookie,
      url: origin,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error("BROWSER ERROR:", error.message);
  });
  await page.goto(origin + "/admin/posts/new");
  await page
    .getByLabel("Title", { exact: true })
    .fill("Browser publishing test");
  await page.getByLabel("Content type").selectOption("ARTICLE");
  const editor = page.getByRole("textbox", {
    name: "Post content",
    exact: true,
  });
  await editor.fill("Written and checked in the browser.");
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await editor.locator("table").waitFor();
  await page.getByRole("button", { name: "Add row", exact: true }).click();
  assert.equal(await editor.locator("tr").count(), 4);
  await page.getByLabel("Featured image", { exact: true }).selectOption("1");
  await page
    .getByLabel("Insert image into content", { exact: true })
    .selectOption("1");
  await page
    .getByRole("button", { name: "Insert image into content", exact: true })
    .click();
  await editor
    .getByRole("img", { name: "A green test image", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.waitForURL(/\/admin\/posts\/\d+$/);
  await page
    .getByText(
      "As the admin, I approve publishing this post with fewer than 400 words.",
      { exact: true },
    )
    .click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Saved" }).first().waitFor();
  await page.screenshot({
    path: ".local/phase2-editor-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Administration" })
    .getByRole("link", { name: "Posts", exact: true })
    .click();
  await page.getByRole("heading", { name: "Posts", exact: true }).waitFor();
  const result = await db.query(
    'SELECT slug,status,body FROM "Post" WHERE title=$1',
    ["Browser publishing test"],
  );
  assert.equal(result.rows[0].status, "PUBLISHED");
  assert.ok(result.rows[0].body.includes("Written and checked"));
  await page.goto(origin + "/" + result.rows[0].slug);
  await page
    .getByRole("heading", { name: "Browser publishing test", exact: true })
    .waitFor();
  await page.goto(origin + "/admin/posts");
  await page
    .getByRole("link", { name: "Browser publishing test", exact: true })
    .waitFor();
  await page.screenshot({
    path: ".local/phase2-admin-desktop.png",
    fullPage: true,
  });
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + "/");
    await page.getByRole("heading", { level: 1 }).waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      `Public layout overflow at ${width}px`,
    );
    await page.goto(origin + "/admin/posts/new");
    await page.getByLabel("Title", { exact: true }).waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      `Editor layout overflow at ${width}px`,
    );
  }
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(origin + "/");
  await page.screenshot({
    path: ".local/phase2-public-mobile.png",
    fullPage: false,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: browser editor create/save/publish, public content, admin navigation, and layouts at 360/768/1440 px without browser exceptions.",
  );
  await context.close();
} finally {
  await browser.close();
  await db.query('DELETE FROM "Session" WHERE id=$1', [id]);
  await db.end();
}
