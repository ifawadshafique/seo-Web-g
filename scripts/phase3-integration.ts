import "dotenv/config";
import assert from "node:assert/strict";
import sharp from "sharp";
import prisma from "../src/lib/prisma";
import { sealToken, token, digest } from "../src/lib/security";
import { defaultSlots } from "../src/lib/ad-policy";
import { cspPolicy, policyHash } from "../src/lib/csp";
import { parseDocument, DomUtils } from "htmlparser2";
if (new URL(process.env.DATABASE_URL!).pathname !== "/seo_phase3_test")
  throw new Error("Use the disposable seo_phase3_test database");
const origin = process.env.SITE_URL ?? "http://localhost:3103";
const basic =
  "Basic " + Buffer.from(process.env.STAGING_BASIC_AUTH!).toString("base64");
let cookie = "";
async function call(path: string, body?: unknown, method = "GET") {
  return fetch(origin + path, {
    method,
    redirect: "manual",
    headers: {
      Authorization: basic,
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function json(path: string, body?: unknown, method = "GET") {
  const response = await call(path, body, method);
  const text = await response.text();
  assert.ok(response.ok, `${path}: ${response.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}
const primary = (html: string) =>
  [
    ...html.matchAll(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ].map((match) => JSON.parse(match[1]));
export const intro = Array.from(
  { length: 155 },
  (_, index) => `guidance${index}`,
).join(" ");
async function main() {
  // Vercel's scheduler sends Bearer auth instead of a browser's Basic credential.
  const cronHeaders = { Authorization: `Bearer ${process.env.CRON_SECRET}` };
  assert.equal(
    (await fetch(origin + "/api/cron", { headers: cronHeaders })).status,
    200,
  );
  assert.equal(
    (
      await fetch(origin + "/admin", {
        headers: cronHeaders,
        redirect: "manual",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(origin + "/api/cron", {
        headers: { Authorization: "Bearer incorrect" },
      })
    ).status,
    401,
  );
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Post", "Category", "User", "Page", "SlugRegistry", "LoginBucket", "Tag", "Redirect", "Setting", "AdSlot", "JobReport", "TrafficEvent", "CspViolation", "CspAudit", "ContactMessage", "MailOutbox", "WorkerRun" RESTART IDENTITY CASCADE',
  );
  const admin = await prisma.user.create({
    data: {
      name: "Phase 3 Editor",
      email: "phase3-admin@example.com",
      passwordHash: "unused",
      role: "ADMIN",
      mfaEnabled: true,
    },
  });
  const editor = await prisma.user.create({
    data: {
      name: "Limited Editor",
      email: "phase3-editor@example.com",
      passwordHash: "unused",
      role: "EDITOR",
      mfaEnabled: true,
    },
  });
  async function session(userId: number) {
    const value = token();
    await prisma.session.create({
      data: {
        id: digest(value),
        userId,
        version: 0,
        mfaVerified: true,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    return "seo_session=" + encodeURIComponent(await sealToken(value));
  }
  const adminCookie = await session(admin.id),
    editorCookie = await session(editor.id);
  const category = await prisma.category.create({
    data: { name: "Pakistan careers", slug: "pakistan", description: intro },
  });
  const tag = await prisma.tag.create({
    data: { name: "Engineering", slug: "engineering", description: intro },
  });
  await prisma.tag.create({
    data: { name: "Thin", slug: "thin", description: intro },
  });
  const media = await prisma.media.create({
    data: {
      url: "/api/media/11111111-1111-4111-a111-111111111111.webp",
      altText: "A workshop workspace",
      width: 1600,
      height: 900,
      mimeType: "image/webp",
      sizeBytes: 10000,
      uploadedBy: admin.id,
    },
  });
  const paragraph =
    "Read the original employer requirements and check the official application details before applying. ";
  const body =
    "<p>First paragraph describing this opportunity.</p>" +
    Array.from(
      { length: 16 },
      (_, index) =>
        `<h2>Section ${index + 1}</h2><p>${paragraph.repeat(4)}</p>`,
    ).join("");
  for (let index = 0; index < 10; index++) {
    const job = index < 5;
    await prisma.post.create({
      data: {
        title: job
          ? `Engineering opportunity ${index + 1}`
          : `Career guide ${index - 4}`,
        slug: job
          ? `engineering-role-${index + 1}`
          : `career-guide-${index - 4}`,
        contentType: job ? "JOB" : "ARTICLE",
        body,
        excerpt: `Original ${job ? "job listing" : "career article"} number ${index + 1} with source details.`,
        status: "PUBLISHED",
        publishedAt: new Date(Date.now() - 86400000),
        authorId: admin.id,
        categoryId: category.id,
        featuredMediaId: media.id,
        adsEnabled: true,
        tags: { create: [{ tagId: tag.id }] },
        ...(job
          ? {
              jobDetails: {
                create: {
                  employerName: `Example employer ${index + 1}`,
                  location: "Karachi",
                  country: "Pakistan",
                  workplaceType: index === 4 ? "Remote" : "On-site",
                  employmentType: "FULL_TIME",
                  applicationUrl: "https://example.com/careers",
                  sourceUrl: "https://example.com/careers",
                  linkAttestedAt: new Date(),
                  linkAttestedBy: String(admin.id),
                  closingDate: new Date(Date.now() + 7 * 86400000),
                  salaryMin: 1000,
                  salaryMax: 2000,
                  salaryCurrency: "USD",
                  salaryPeriod: "MONTH",
                },
              },
            }
          : {}),
      },
    });
  }
  for (const [slug, status, noindex] of [
    ["hidden-draft", "DRAFT", false],
    ["hidden-scheduled", "SCHEDULED", false],
    ["hidden-archived", "ARCHIVED", false],
    ["hidden-noindex", "PUBLISHED", true],
  ] as const)
    await prisma.post.create({
      data: {
        title: slug,
        slug,
        status,
        noindex,
        body: "<p>Private or excluded content</p>",
        contentType: "ARTICLE",
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        authorId: admin.id,
        categoryId: category.id,
      },
    });
  await prisma.page.create({
    data: {
      title: "About the site",
      slug: "about",
      body: "<p>About this site.</p>",
      status: "PUBLISHED",
    },
  });
  assert.equal(
    (await fetch(origin + "/")).status,
    401,
    "Staging must require authentication",
  );
  for (let index = 0; index < 10; index++) {
    const path =
      index < 5
        ? `/engineering-role-${index + 1}`
        : `/career-guide-${index - 4}`;
    const response = await call(path);
    assert.equal(response.status, 200);
    const html = await response.text();
    const schemas = primary(html);
    assert.equal(
      schemas.filter(
        (schema) => schema["@type"] === (index < 5 ? "JobPosting" : "Article"),
      ).length,
      1,
    );
    assert.equal(
      schemas.filter(
        (schema) => schema["@type"] === (index < 5 ? "Article" : "JobPosting"),
      ).length,
      0,
    );
    assert.equal(
      schemas.filter((schema) => schema["@type"] === "BreadcrumbList").length,
      1,
    );
    const doc = parseDocument(html);
    assert.equal(
      DomUtils.getElementsByTagName("h1", doc.children, true).length,
      1,
    );
    const canonical = DomUtils.getElementsByTagName(
      "link",
      doc.children,
      true,
    ).filter((node) => node.attribs.rel === "canonical");
    assert.equal(canonical.length, 1);
    assert.equal(canonical[0].attribs.href, origin + path);
    assert.ok(
      response.headers
        .get("content-security-policy-report-only")
        ?.includes("nonce-"),
    );
    assert.ok(html.includes('name="twitter:card"'));
  }
  const home = await (await call("/")).text();
  assert.ok(primary(home).some((schema) => schema["@type"] === "Organization"));
  const sitemap = await (await call("/sitemap.xml")).text();
  assert.ok(sitemap.includes("posts-0.xml"));
  const postsXml = await (await call("/sitemaps/posts-0.xml")).text();
  assert.ok(postsXml.includes("engineering-role-1"));
  for (const slug of [
    "hidden-draft",
    "hidden-scheduled",
    "hidden-archived",
    "hidden-noindex",
  ])
    assert.ok(!postsXml.includes(slug));
  const tagsXml = await (await call("/sitemaps/tags-0.xml")).text();
  assert.ok(tagsXml.includes("engineering"));
  assert.ok(!tagsXml.includes("/thin"));
  const rss = await (await call("/feed")).text();
  assert.ok(rss.includes("<rss"));
  assert.ok(!rss.includes("hidden-noindex"));
  const search = await (await call("/search?q=engineering")).text();
  assert.ok(search.includes('content="noindex, follow"'));
  const robots = await (await call("/robots.txt")).text();
  assert.ok(robots.includes("Disallow: /"));
  const image = await call("/api/og?post=engineering-role-1");
  assert.equal(image.status, 200);
  const dimensions = await sharp(
    Buffer.from(await image.arrayBuffer()),
  ).metadata();
  assert.equal(dimensions.width, 1200);
  assert.equal(dimensions.height, 630);
  const first = await prisma.post.findUniqueOrThrow({
    where: { slug: "engineering-role-1" },
  });
  await prisma.jobDetails.update({
    where: { postId: first.id },
    data: { closingDate: new Date(Date.now() - 60000) },
  });
  assert.ok(
    !primary(await (await call("/engineering-role-1")).text()).some(
      (schema) => schema["@type"] === "JobPosting",
    ),
  );
  await prisma.jobDetails.update({
    where: { postId: first.id },
    data: { closingDate: new Date(Date.now() + 7 * 86400000) },
  });
  assert.equal(
    (
      await call(
        "/api/reports",
        {
          slug: "engineering-role-1",
          note: "This listing needs a safety review",
          startedAt: Date.now() - 5000,
          website: "",
        },
        "POST",
      )
    ).status,
    202,
  );
  assert.equal(
    (
      await call(
        "/api/reports",
        {
          slug: "engineering-role-1",
          note: "Automated spam report",
          startedAt: Date.now() - 5000,
          website: "spam",
        },
        "POST",
      )
    ).status,
    400,
  );
  cookie = editorCookie;
  assert.equal((await call("/api/admin/moderation")).status, 403);
  assert.equal((await call("/api/admin/ads")).status, 403);
  cookie = adminCookie;
  const reports = await json("/api/admin/moderation");
  assert.equal(reports.length, 1);
  await json(
    "/api/admin/moderation",
    {
      id: reports[0].id,
      status: "UNDER_REVIEW",
      resolution: "Listing withheld while the source is investigated.",
    },
    "POST",
  );
  cookie = "";
  assert.equal((await call("/engineering-role-1")).status, 404);
  assert.ok(
    !(await (await call("/sitemaps/posts-0.xml")).text()).includes(
      "engineering-role-1",
    ),
  );
  cookie = adminCookie;
  await json(
    "/api/admin/moderation",
    {
      id: reports[0].id,
      status: "RESOLVED",
      resolution: "The issue was reviewed; editor must explicitly republish.",
    },
    "POST",
  );
  assert.equal(
    (await prisma.post.findUniqueOrThrow({ where: { id: first.id } })).status,
    "UNPUBLISHED",
  );
  await prisma.post.update({
    where: { id: first.id },
    data: { status: "PUBLISHED" },
  });
  const config = {
    ads_mode: "placeholder",
    publisher_id: "",
    cookiebot_id: "",
    ga4_id: "",
    slots: defaultSlots.map((slot) => ({
      ...slot,
      enabled: true,
      slotId: "1234567890",
    })),
  };
  await json("/api/admin/ads", config, "POST");
  assert.equal(
    (
      await call(
        "/api/admin/ads",
        { ...config, script: "<script>alert(1)</script>" },
        "POST",
      )
    ).status,
    400,
  );
  cookie = "";
  const placeholders = await (await call("/engineering-role-1")).text();
  assert.ok(placeholders.includes('data-ad-mode="placeholder"'));
  for (const path of [
    "/search",
    "/contact",
    "/missing-page",
    "/report/engineering-role-1",
  ]) {
    assert.ok(
      !(await (await call(path)).text()).includes("data-ad-placement="),
      path,
    );
  }
  cookie = adminCookie;
  assert.ok(
    !(await (await call("/engineering-role-1")).text()).includes(
      "data-ad-placement=",
    ),
  );
  assert.equal(
    (
      await call(
        "/api/admin/search-health",
        {
          action: "review-csp",
          note: "Attempting review before the observation period.",
        },
        "POST",
      )
    ).status,
    400,
  );
  cookie = "";
  await prisma.redirect.create({
    data: { fromPath: "/old-career-link", toPath: "/career-guide-1" },
  });
  assert.equal((await call("/old-career-link?private=redacted")).status, 301);
  await call("/missing-career-link?email=private@example.com");
  await new Promise((resolve) => setTimeout(resolve, 200));
  cookie = adminCookie;
  const health = await json("/api/admin/search-health");
  assert.ok(
    health.traffic.some(
      (event: { path: string }) => event.path === "/missing-career-link",
    ),
  );
  assert.ok(
    health.traffic.every(
      (event: { path: string }) => !event.path.includes("?"),
    ),
  );
  const policy = cspPolicy("test");
  cookie = "";
  assert.equal(
    (
      await call(
        "/api/security/csp-report",
        {
          "csp-report": {
            "document-uri": origin + "/career-guide-1?private=secret",
            "effective-directive": "script-src-elem",
            "blocked-uri": "https://untrusted.example/path?token=secret",
            "original-policy": policy,
            disposition: "report",
          },
        },
        "POST",
      )
    ).status,
    204,
  );
  const violation = await prisma.cspViolation.findFirstOrThrow();
  assert.equal(violation.blockedOrigin, "https://untrusted.example");
  assert.ok(!violation.path.includes("?"));
  assert.equal(violation.policyHash, policyHash(policy));
  console.log(
    "PASS: 5 job + 5 article schemas, breadcrumbs, canonical/social metadata, private/noindex sitemap filtering, RSS/robots, 1200×630 social cards, expiry schema removal, report moderation/unpublishing, role checks, typed staging ads, admin/excluded-page ad suppression, privacy-safe traffic/CSP reports, and seven-day review guard.",
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
