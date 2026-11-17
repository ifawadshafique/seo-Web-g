import "dotenv/config";
import assert from "node:assert/strict";
import sharp from "sharp";
import prisma from "../src/lib/prisma";
import { digest, sealToken, token, encrypt } from "../src/lib/security";
import { toSiteTime } from "../src/lib/content-shared";

if (new URL(process.env.DATABASE_URL!).pathname !== "/seo_phase2_test")
  throw new Error("Use the disposable seo_phase2_test database");
const origin = process.env.SITE_URL ?? "http://localhost:3102";
let cookie = "";
const intro = "Read the source carefully and review the requirements before making an application. ".repeat(16);
async function call(
  path: string,
  body?: unknown,
  method = "GET",
  sendOrigin = true,
) {
  const response = await fetch(origin + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookie,
      ...(sendOrigin ? { Origin: origin } : {}),
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    ...(body
      ? { body: body instanceof FormData ? body : JSON.stringify(body) }
      : {}),
  });
  return response;
}
async function json(path: string, body?: unknown, method = "GET") {
  const response = await call(path, body, method);
  const data = await response.json();
  assert.ok(
    response.ok,
    `${method} ${path}: ${response.status} ${JSON.stringify(data)}`,
  );
  return data;
}
async function main() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Post", "Category", "User", "Page", "SlugRegistry", "LoginBucket", "ContactMessage", "MailOutbox", "WorkerRun", "Tag", "Redirect" RESTART IDENTITY CASCADE',
  );
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin",
      email: "phase2-admin@example.com",
      passwordHash: "unused",
      role: "ADMIN",
      mfaEnabled: true,
      mfaSecret: encrypt("JBSWY3DPEHPK3PXP"),
    },
  });
  const editor = await prisma.user.create({
    data: {
      name: "Test Editor",
      email: "phase2-editor@example.com",
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
  const adminCookie = await session(admin.id);
  const editorCookie = await session(editor.id);
  assert.equal((await call("/api/admin/posts")).status, 401);
  cookie = adminCookie;
  assert.equal(
    (await call("/api/admin/taxonomy", {}, "POST", false)).status,
    403,
  );
  await json(
    "/api/admin/taxonomy",
    {
      kind: "category",
      name: "Test Country",
      slug: "test-country",
      description: intro,
    },
    "POST",
  );
  await json(
    "/api/admin/taxonomy",
    {
      kind: "tag",
      name: "Welder",
      slug: "welder",
      description: intro,
    },
    "POST",
  );
  const terms = await json("/api/admin/taxonomy");
  const category = terms.categories[0],
    tag = terms.tags[0];
  const base = {
    title: "Phase two draft",
    slug: "phase-two-draft",
    contentType: "ARTICLE",
    body: "<h2>Requirements</h2><p>Find this unique quasarengineering term.</p><script>window.evil=true</script>",
    excerpt: "A practical career article.",
    categoryId: category.id,
    tagIds: [tag.id],
    confirmShort: true,
  };
  const draft = await json("/api/admin/posts", base, "POST");
  assert.ok(!draft.post.body.includes("script"));
  cookie = "";
  assert.equal((await call("/phase-two-draft")).status, 404);
  assert.equal((await call("/api/posts/phase-two-draft")).status, 404);
  const unauthorizedPreview = await call(`/admin/preview/${draft.post.id}`);
  assert.ok(!(await unauthorizedPreview.text()).includes("quasarengineering"));
  cookie = adminCookie;
  const preview = await call(`/admin/preview/${draft.post.id}`);
  assert.ok((await preview.text()).includes("quasarengineering"));
  assert.equal(
    (
      await call(
        `/api/admin/posts/${draft.post.id}`,
        { ...base, contentType: "JOB", status: "PUBLISHED" },
        "PATCH",
      )
    ).status,
    400,
  );
  const published = await json(
    `/api/admin/posts/${draft.post.id}`,
    { ...base, status: "PUBLISHED" },
    "PATCH",
  );
  assert.equal(published.post.status, "PUBLISHED");
  cookie = "";
  const detail = await call("/phase-two-draft");
  assert.equal(detail.status, 200);
  assert.ok((await detail.text()).includes("quasarengineering"));
  const search = await call("/search?q=quasarengineering");
  assert.ok((await search.text()).includes("Phase two draft"));
  const filter = await call("/tag/welder");
  assert.ok((await filter.text()).includes("Phase two draft"));
  cookie = adminCookie;
  const renamed = {
    ...base,
    title: "Renamed article",
    slug: "renamed-article",
    status: "PUBLISHED",
  };
  await json(`/api/admin/posts/${draft.post.id}`, renamed, "PATCH");
  cookie = "";
  const redirect = await call("/phase-two-draft");
  assert.equal(redirect.status, 301);
  assert.equal(
    new URL(redirect.headers.get("location")!, origin).pathname,
    "/renamed-article",
  );
  cookie = adminCookie;
  const copy = await json(`/api/admin/posts/${draft.post.id}`, {}, "POST");
  assert.equal(copy.status, "DRAFT");
  assert.notEqual(copy.slug, renamed.slug);
  // Database-backed scheduling, interruption recovery, and exactly-once publication.
  const future = toSiteTime(new Date(Date.now() + 3600000), "Asia/Karachi");
  const scheduled = await json(
    "/api/admin/posts",
    {
      ...base,
      title: "Scheduled quasarengineering role",
      slug: "scheduled-role",
      status: "SCHEDULED",
      scheduledLocal: future,
    },
    "POST",
  );
  cookie = "";
  assert.equal((await call("/scheduled-role")).status, 404);
  const due = new Date(Date.now() - 60000);
  await prisma.post.update({
    where: { id: scheduled.post.id },
    data: { scheduledAt: due },
  });
  await prisma.publishTask.update({
    where: { postId: scheduled.post.id },
    data: { runAt: due, nextAttemptAt: due },
  });
  assert.equal((await call("/api/cron")).status, 401);
  const tick = () =>
    fetch(origin + "/api/cron", {
      headers: { Authorization: "Bearer " + process.env.CRON_SECRET },
    });
  assert.equal((await tick()).status, 200);
  assert.equal((await tick()).status, 200);
  assert.equal(
    await prisma.auditLog.count({
      where: {
        entityId: scheduled.post.id,
        action: "POST_SCHEDULED_PUBLISHED",
      },
    }),
    1,
  );
  assert.equal((await call("/scheduled-role")).status, 200);
  // A forced validation failure must retry and queue an alert, then recover.
  cookie = adminCookie;
  const retry = await json(
    "/api/admin/posts",
    {
      ...base,
      title: "Retry role",
      slug: "retry-role",
      status: "SCHEDULED",
      scheduledLocal: future,
    },
    "POST",
  );
  await prisma.post.update({
    where: { id: retry.post.id },
    data: { scheduledAt: due, body: "<p>guaranteed visa</p>" },
  });
  await prisma.publishTask.update({
    where: { postId: retry.post.id },
    data: { runAt: due, nextAttemptAt: due },
  });
  await tick();
  const failed = await prisma.publishTask.findUniqueOrThrow({
    where: { postId: retry.post.id },
  });
  assert.equal(failed.state, "RETRY");
  assert.equal(failed.attempts, 1);
  assert.ok(
    await prisma.mailOutbox.count({
      where: { subject: "Scheduled publication needs attention" },
    }),
  );
  await prisma.post.update({
    where: { id: retry.post.id },
    data: { body: "<p>Restored content.</p>" },
  });
  await prisma.publishTask.update({
    where: { postId: retry.post.id },
    data: { nextAttemptAt: due },
  });
  await tick();
  assert.equal(
    (
      await prisma.publishTask.findUniqueOrThrow({
        where: { postId: retry.post.id },
      })
    ).state,
    "DONE",
  );
  cookie = adminCookie;
  const vacancy = await json(
    "/api/admin/posts",
    {
      ...base,
      title: "Test welding opportunity",
      slug: "welding-opportunity",
      contentType: "JOB",
      status: "PUBLISHED",
      job: {
        employerName: "Example Employer",
        location: "Example City",
        country: "Example Country",
        workplaceType: "On-site",
        employmentType: "FULL_TIME",
        applicationUrl: "https://example.com",
        sourceUrl: "https://example.com",
        attested: true,
      },
    },
    "POST",
  );
  const vacancyHtml = await (await call("/welding-opportunity")).text();
  assert.ok(vacancyHtml.includes("Example Employer"));
  assert.ok(vacancyHtml.includes("Never pay for an interview"));
  await prisma.jobDetails.update({
    where: { postId: vacancy.post.id },
    data: { closingDate: due },
  });
  await tick();
  assert.equal(
    (
      await prisma.jobDetails.findUniqueOrThrow({
        where: { postId: vacancy.post.id },
      })
    ).jobStatus,
    "EXPIRED",
  );
  assert.ok(
    (await (await call("/welding-opportunity")).text()).includes(
      "This opportunity is no longer open",
    ),
  );
  for (let index = 0; index < 13; index++)
    await prisma.post.create({
      data: {
        title: `Pagination article ${index}`,
        slug: `pagination-article-${index}`,
        contentType: "ARTICLE",
        body: "<p>Pagination content</p>",
        categoryId: category.id,
        authorId: admin.id,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
  const firstPage = await (await call("/category/test-country")).text();
  assert.equal(
    (firstPage.match(/<article class="post-card">/g) ?? []).length,
    12,
  );
  assert.equal((await call("/category/test-country?page=2")).status, 200);
  const start = performance.now();
  assert.equal((await call("/search?q=quasarengineering")).status, 200);
  assert.ok(
    performance.now() - start < 1000,
    "Search should finish within one second on test fixtures",
  );
  // Safe image conversion and rejected executable files.
  const upload = new FormData();
  upload.set("alt", "A green test image");
  upload.set(
    "file",
    new Blob(
      [
        new Uint8Array(
          await sharp({
            create: { width: 40, height: 30, channels: 3, background: "green" },
          })
            .png()
            .toBuffer(),
        ),
      ],
      { type: "image/png" },
    ),
    "test.png",
  );
  const image = await json("/api/admin/media", upload, "POST");
  assert.equal(image.mimeType, "image/webp");
  assert.equal((await call(image.url)).status, 200);
  const invalid = new FormData();
  invalid.set("alt", "Unsafe");
  invalid.set(
    "file",
    new Blob(["<svg><script>alert(1)</script></svg>"], {
      type: "image/svg+xml",
    }),
    "evil.svg",
  );
  assert.equal((await call("/api/admin/media", invalid, "POST")).status, 400);
  // Settings, pages, taxonomy merge, bulk actions and editor boundaries.
  const settings = await json("/api/admin/settings");
  assert.equal(
    (
      await call(
        "/api/admin/settings",
        { ...settings, site_timezone: "Mars/Bad" },
        "POST",
      )
    ).status,
    400,
  );
  await json(
    "/api/admin/pages",
    {
      slug: "about",
      title: "About this test site",
      body: "<p>Published page content.</p>",
      status: "PUBLISHED",
    },
    "POST",
  );
  assert.equal((await call("/about")).status, 200);
  await json(
    "/api/admin/taxonomy",
    {
      kind: "tag",
      name: "Merged",
      slug: "merged",
      description: intro,
    },
    "POST",
  );
  const target = (await json("/api/admin/taxonomy")).tags.find(
    (item: { slug: string }) => item.slug === "merged",
  );
  await json(
    "/api/admin/taxonomy",
    { kind: "tag", operation: "merge", id: tag.id, targetId: target.id },
    "POST",
  );
  assert.equal(
    await prisma.postTag.count({
      where: { postId: draft.post.id, tagId: target.id },
    }),
    1,
  );
  await json(
    "/api/admin/bulk",
    { ids: [copy.id], action: "publish", confirmShort: true },
    "POST",
  );
  await json(
    "/api/admin/bulk",
    { ids: [copy.id], action: "unpublish" },
    "POST",
  );
  assert.equal(
    (await prisma.post.findUniqueOrThrow({ where: { id: copy.id } })).status,
    "UNPUBLISHED",
  );
  await json(`/api/admin/posts/${copy.id}`, undefined, "DELETE");
  assert.ok(
    (await prisma.post.findUniqueOrThrow({ where: { id: copy.id } })).deletedAt,
  );
  cookie = editorCookie;
  assert.equal((await call("/api/admin/settings")).status, 403);
  assert.equal((await call("/api/admin/inbox")).status, 403);
  assert.equal((await call("/api/admin/pages", {}, "POST")).status, 403);
  cookie = "";
  assert.equal(
    (
      await call(
        "/api/contact",
        {
          name: "Visitor",
          email: "visitor@example.com",
          message: "Please help with this test message",
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
        "/api/contact",
        {
          name: "Bot",
          email: "bot@example.com",
          message: "Spam message text",
          startedAt: Date.now() - 5000,
          website: "filled",
        },
        "POST",
      )
    ).status,
    400,
  );
  await tick();
  cookie = adminCookie;
  const inbox = await json("/api/admin/inbox");
  assert.equal(inbox.messages.length, 1);
  assert.ok(
    inbox.mail.some((mail: { state: string }) => mail.state === "LOCAL"),
  );
  console.log(
    "PASS: draft isolation, preview auth, validation, sanitized HTML, publication, full-text search, taxonomy, 301 redirects, duplication, durable scheduling, exactly-once recovery, failure retries/alerts, image conversion, role/CSRF controls, pages, bulk actions, soft deletion, and local contact delivery.",
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
