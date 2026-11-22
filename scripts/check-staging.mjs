import "dotenv/config";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { parseDocument, DomUtils } from "htmlparser2";

// Read-only deployment checks. This script never connects to a database or changes ads/content.
const value = process.argv[2];
if (!value || value === "--help") {
  console.log(
    "Usage: npm run check:staging -- https://your-staging-host.example\nSet STAGING_BASIC_AUTH privately, or STAGING_PUBLIC_ACCESS=true for a public preview. Reports go to .local/staging-check.json.",
  );
  process.exit(value ? 0 : 1);
}
const origin = new URL(value);
assert.ok(
  origin.protocol === "https:" &&
    !origin.username &&
    !origin.password &&
    origin.pathname === "/" &&
    !origin.search &&
    !origin.hash,
  "Supply an HTTPS staging origin without credentials, a path or a query",
);
const publicAccess = process.env.STAGING_PUBLIC_ACCESS === "true";
assert.ok(
  publicAccess || process.env.STAGING_BASIC_AUTH,
  "Set STAGING_BASIC_AUTH privately before running deployment checks",
);
const authorization = process.env.STAGING_BASIC_AUTH
  ? "Basic " + Buffer.from(process.env.STAGING_BASIC_AUTH).toString("base64")
  : "";
const report = {
  checkedAt: new Date().toISOString(),
  origin: origin.origin,
  pages: [],
  accessMode: publicAccess ? "public-preview" : "protected",
  pendingExternal: [
    "Google Rich Results validation",
    "Real Cookiebot regional/TCF checks",
    "Lighthouse in both ads modes",
    "Seven uninterrupted staging days and owner CSP review",
  ],
};
const tags = (document, name) =>
  DomUtils.getElementsByTagName(name, document.children, true);
async function get(path, authenticated = true) {
  const url = new URL(path, origin);
  assert.equal(
    url.origin,
    origin.origin,
    "Refusing to send credentials to another origin",
  );
  const response = await fetch(url, {
    redirect: "manual",
    headers: authenticated
      ? {
          ...(authorization ? { Authorization: authorization } : {}),
          ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET
            ? {
                "x-vercel-protection-bypass":
                  process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
              }
            : {}),
        }
      : {},
    signal: AbortSignal.timeout(30000),
  });
  return { response, text: await response.text() };
}
async function xml(path, root) {
  const { response, text } = await get(path);
  assert.equal(response.status, 200, `${path}: expected HTTP 200`);
  assert.match(response.headers.get("content-type") ?? "", /xml/);
  const document = parseDocument(text, { xmlMode: true });
  assert.equal(tags(document, root).length, 1, `${path}: missing XML root`);
  return document;
}
try {
  if (publicAccess) {
    for (const path of ["/", "/sitemap.xml"])
      assert.equal(
        (await get(path, false)).response.status,
        200,
        `${path}: public preview must be accessible without credentials`,
      );
    assert.equal(
      (await get("/api/admin/posts", false)).response.status,
      401,
      "Public access must not grant admin access",
    );
  }
  for (const path of publicAccess ? [] : ["/", "/admin", "/sitemap.xml"]) {
    const { response } = await get(path, false);
    assert.ok(
      [401, 403, 302, 307].includes(response.status),
      `${path}: staging must require authentication`,
    );
    if ([302, 307].includes(response.status)) {
      const destination = new URL(
        response.headers.get("location") ?? "",
        origin,
      );
      assert.ok(
        destination.hostname === "vercel.com" ||
          destination.hostname.endsWith(".vercel.com"),
        "Unexpected staging authentication redirect",
      );
    }
  }
  const robots = await get("/robots.txt");
  assert.equal(robots.response.status, 200);
  assert.match(
    robots.text,
    /Disallow:\s*\/\s*(?:\n|$)/,
    "Staging robots must disallow indexing",
  );
  const index = await xml("/sitemap.xml", "sitemapindex");
  const urls = new Set(
    ["/", "/search", "/contact"].map((path) => new URL(path, origin).href),
  );
  for (const loc of tags(index, "loc")) {
    const chunk = await xml(DomUtils.textContent(loc).trim(), "urlset");
    for (const entry of tags(chunk, "loc"))
      urls.add(new URL(DomUtils.textContent(entry).trim(), origin).href);
  }
  assert.ok(
    urls.size <= 200,
    "Use a separate full crawler for deployments over 200 URLs",
  );
  await xml("/feed", "rss");
  let jobs = 0,
    articles = 0;
  const titles = new Set(),
    descriptions = new Set();
  for (const path of urls) {
    const url = new URL(path, origin);
    const { response, text } = await get(url);
    assert.equal(response.status, 200, `${url.pathname}: expected HTTP 200`);
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
    const policy = response.headers.get("content-security-policy-report-only");
    assert.ok(
      policy && !response.headers.has("content-security-policy"),
      "Phase 3 staging must use CSP report-only until the real review is completed",
    );
    const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
    assert.ok(nonce, "Missing unpredictable CSP nonce");
    const document = parseDocument(text);
    assert.equal(
      tags(document, "h1").length,
      1,
      `${url.pathname}: expected one H1`,
    );
    const title = DomUtils.textContent(tags(document, "title")[0] ?? {}).trim();
    const metas = tags(document, "meta");
    const description = metas.find(
      (node) => node.attribs.name === "description",
    )?.attribs.content;
    assert.ok(
      title && description,
      `${url.pathname}: missing server-rendered metadata`,
    );
    assert.ok(
      !titles.has(title) && !descriptions.has(description),
      `${url.pathname}: duplicate authored title or description`,
    );
    titles.add(title);
    descriptions.add(description);
    const links = tags(document, "link");
    const canonical = links.find((node) => node.attribs.rel === "canonical")
      ?.attribs.href;
    assert.ok(canonical, `${url.pathname}: missing canonical`);
    assert.equal(
      new URL(canonical).href,
      url.href,
      `${url.pathname}: incorrect canonical`,
    );
    assert.ok(metas.some((node) => node.attribs.property === "og:image"));
    assert.ok(metas.some((node) => node.attribs.name === "twitter:card"));
    for (const image of tags(document, "img"))
      assert.ok(
        "alt" in image.attribs &&
          Number(image.attribs.width) > 0 &&
          Number(image.attribs.height) > 0,
        `${url.pathname}: image needs alt text and dimensions`,
      );
    const schemas = [];
    for (const script of tags(document, "script")) {
      if (!script.attribs.src)
        assert.equal(
          script.attribs.nonce,
          nonce,
          `${url.pathname}: inline script nonce mismatch`,
        );
      if (script.attribs.type === "application/ld+json")
        schemas.push(JSON.parse(DomUtils.textContent(script)));
    }
    jobs += schemas.filter((item) => item["@type"] === "JobPosting").length;
    articles += schemas.filter((item) => item["@type"] === "Article").length;
    report.pages.push({
      path: url.pathname,
      title,
      schemas: schemas.map((item) => item["@type"]),
    });
  }
  assert.ok(
    jobs >= 5 && articles >= 5,
    "AC-3 requires at least five eligible jobs and five articles on staging",
  );
  assert.equal(
    (await get("/api/admin/search-health")).response.status,
    401,
    "Basic authentication must not grant administrator access",
  );
  report.passed = true;
  console.log(
    `PASS: ${publicAccess ? "public preview" : "protected staging"}, robots, sitemap, RSS, server metadata, nonce coverage, ${jobs} jobs and ${articles} articles. External checks remain listed in the report.`,
  );
} catch (error) {
  report.passed = false;
  report.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mkdir(".local", { recursive: true });
  await writeFile(
    ".local/staging-check.json",
    JSON.stringify(report, null, 2),
    { mode: 0o600 },
  );
}
