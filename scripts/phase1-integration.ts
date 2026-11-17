import assert from "node:assert/strict";
import { generate } from "otplib";
import prisma from "../src/lib/prisma";
import { hashPassword, digest, readToken } from "../src/lib/security";

// Destructive fixtures are restricted to a disposable, explicitly named database.
if (!process.env.DATABASE_URL?.endsWith("/seo_phase1_test"))
  throw new Error("Use a disposable seo_phase1_test database");
const origin = process.env.SITE_URL ?? "http://localhost:3100";
let cookie = "";
async function call(
  path: string,
  body?: object,
  method = "POST",
  sendOrigin = true,
) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      ...(sendOrigin ? { Origin: origin } : {}),
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return response;
}
async function login(email: string) {
  cookie = "";
  const response = await call("/api/auth/login", {
    email,
    password: "test-password-long-123",
  });
  assert.equal(response.status, 200);
}
async function main() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Post", "Category", "User", "Page", "SlugRegistry", "LoginBucket" RESTART IDENTITY CASCADE',
  );
  await prisma.loginBucket.deleteMany();
  for (const role of ["ADMIN", "EDITOR"] as const)
    await prisma.user.create({
      data: {
        name: role,
        email: `${role.toLowerCase()}@test.example`,
        passwordHash: await hashPassword("test-password-long-123"),
        role,
      },
    });
  assert.equal((await call("/api/admin/users", undefined, "GET")).status, 401);
  assert.equal(
    (
      await call(
        "/api/auth/login",
        { email: "admin@test.example", password: "test-password-long-123" },
        "POST",
        false,
      )
    ).status,
    403,
  );
  await login("admin@test.example");
  assert.equal((await call("/api/admin/users", undefined, "GET")).status, 401);
  const enrollment = await (await call("/api/auth/enroll")).json();
  assert.ok(enrollment.secret);
  assert.equal((await call("/api/auth/verify", { code: "wrong" })).status, 401);
  const verification = await call("/api/auth/verify", {
    code: await generate({ secret: enrollment.secret }),
  });
  assert.equal(verification.status, 200);
  const { recoveryCodes } = await verification.json();
  assert.equal(recoveryCodes.length, 10);
  assert.equal((await call("/api/admin/users", undefined, "GET")).status, 200);
  const adminCookie = cookie;
  await call("/api/auth/revoke");
  cookie = adminCookie;
  assert.equal((await call("/api/admin/users", undefined, "GET")).status, 401);
  await login("admin@test.example");
  assert.equal(
    (await call("/api/auth/verify", { code: recoveryCodes[0] })).status,
    200,
  );
  const recoveryCookie = cookie;
  await login("admin@test.example");
  assert.equal(
    (await call("/api/auth/verify", { code: recoveryCodes[0] })).status,
    401,
  );
  cookie = recoveryCookie;
  const raw = await readToken(
    decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1)),
  );
  assert.ok(raw);
  await prisma.session.update({
    where: { id: digest(raw) },
    data: { lastSeenAt: new Date(Date.now() - 31 * 60000) },
  });
  assert.equal((await call("/api/admin/users", undefined, "GET")).status, 401);
  await prisma.loginBucket.deleteMany();
  await login("editor@test.example");
  const editorEnrollment = await (await call("/api/auth/enroll")).json();
  assert.equal(
    (
      await call("/api/auth/verify", {
        code: await generate({ secret: editorEnrollment.secret }),
      })
    ).status,
    200,
  );
  assert.equal((await call("/api/admin/users", undefined, "GET")).status, 403);
  assert.equal((await call("/api/admin/audit", undefined, "GET")).status, 403);
  const author = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@test.example" },
  });
  const category = await prisma.category.create({
    data: { name: "Test", slug: "test" },
  });
  const draft = await prisma.post.create({
    data: {
      title: "Draft",
      slug: "private-draft",
      contentType: "ARTICLE",
      body: "private",
      categoryId: category.id,
      authorId: author.id,
    },
  });
  cookie = "";
  assert.equal(
    (await call(`/api/posts/${draft.slug}`, undefined, "GET")).status,
    404,
  );
  const list = await (
    await call("/api/posts?status=DRAFT", undefined, "GET")
  ).json();
  assert.equal(list.total, 0);
  for (const method of ["POST", "PATCH", "PUT", "DELETE"])
    assert.equal(
      (
        await call(
          method === "POST" ? "/api/posts" : `/api/posts/${draft.slug}`,
          {},
          method,
        )
      ).status,
      405,
    );
  await assert.rejects(
    prisma.page.create({
      data: { title: "Collision", slug: draft.slug, body: "" },
    }),
  );
  await assert.rejects(
    prisma.page.create({
      data: { title: "Reserved", slug: "admin", body: "" },
    }),
  );
  await assert.rejects(
    prisma.jobDetails.create({
      data: {
        postId: draft.id,
        employerName: "Test",
        applicationUrl: "https://example.com",
        sourceUrl: "https://example.com",
        salaryMin: 100,
        salaryMax: 10,
      },
    }),
  );
  await prisma.loginBucket.deleteMany();
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await call("/api/auth/login", {
          email: "admin@test.example",
          password: "incorrect",
        })
      ).status,
      401,
    );
  assert.equal(
    (
      await call("/api/auth/login", {
        email: "admin@test.example",
        password: "test-password-long-123",
      })
    ).status,
    429,
  );
  assert.ok(
    (await prisma.auditLog.count({ where: { action: "MFA_ENROLLED" } })) >= 2,
  );
  console.log(
    "PASS: MFA enrollment/login/recovery, replay denial, revocation, inactivity, role enforcement, CSRF, rate limiting, draft isolation, disabled mutations, slug and salary constraints, and audit events",
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
