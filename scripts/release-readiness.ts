import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import prisma from "../src/lib/prisma";
import { postInclude, publicWhere } from "../src/lib/publishing";
import { postSchema } from "../src/lib/seo";
import { cspPolicy, policyHash } from "../src/lib/csp";

// Read-only measurements. Configuration flags never count as provider approval.
async function main() {
  const now = new Date(),
    environment = process.env.APP_ENV ?? "local";
  const hash = policyHash(cspPolicy("NONCE"));
  const [posts, published, pages, audit, worker, settings] = await Promise.all([
    prisma.post.findMany({
      where: { ...publicWhere(), noindex: false },
      include: postInclude,
      take: 1000,
      orderBy: { id: "asc" },
    }),
    prisma.post.count({ where: publicWhere() }),
    prisma.page.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, body: true },
    }),
    prisma.cspAudit.findUnique({ where: { id: environment + "-" + hash } }),
    prisma.workerRun.findUnique({ where: { key: "publishing" } }),
    prisma.setting.findMany({
      where: { key: { in: ["cookiebot_id", "ga4_id"] } },
    }),
  ]);
  const violations = await prisma.cspViolation.count({
    where: {
      policyHash: hash,
      reviewedAt: null,
      ...(audit ? { lastSeenAt: { gte: audit.startedAt } } : {}),
    },
  });
  const schemas = posts.map((post) => postSchema(post, now));
  const jobs = schemas.filter(
    (schema) => schema?.["@type"] === "JobPosting",
  ).length;
  const articles = schemas.filter(
    (schema) => schema?.["@type"] === "Article",
  ).length;
  const days = audit ? Math.max(0, (+now - +audit.startedAt) / 86400000) : 0;
  const fresh = audit ? +now - +audit.lastSeenAt < 600000 : false;
  const report = {
    checkedAt: now.toISOString(),
    environment,
    readyForLaunch: false,
    measurements: {
      publishedPosts: published,
      schemaSampleLimit: 1000,
      eligibleJobs: jobs,
      eligibleArticles: articles,
      schemaSampleMinimumMet: jobs >= 5 && articles >= 5,
      postQuantityMinimumMet: published >= 20,
      missingPublishedPages: [
        "about",
        "privacy-policy",
        "terms",
        "disclaimer",
      ].filter(
        (slug) => !pages.some((page) => page.slug === slug && page.body.trim()),
      ),
      csp: {
        daysObserved: fresh ? days : 0,
        elapsedWindowDays: days,
        heartbeatFresh: fresh,
        reviewed: !!audit?.reviewedAt,
        unreviewedViolations: violations,
        stagingEnforcementEligible:
          environment === "staging" &&
          days >= 7 &&
          fresh &&
          !!audit?.reviewedAt &&
          violations === 0,
      },
      worker: {
        recentSuccessfulTick:
          !!worker?.completedAt &&
          !worker.error &&
          +now - +worker.completedAt < 600000,
        continuousAvailabilityProven: false,
      },
      providerConfiguration: {
        cookiebotPresent: !!(
          settings.find((row) => row.key === "cookiebot_id")?.value ||
          process.env.COOKIEBOT_DOMAIN_GROUP_ID
        ),
        googleVerificationPresent: !!process.env.GOOGLE_SITE_VERIFICATION,
        bingVerificationPresent: !!process.env.BING_SITE_VERIFICATION,
      },
    },
    pendingEvidence: [
      "Original content editorial review and legal-page accuracy approval",
      "Written legal opinion and required changes applied",
      "Real Rich Results validation, webmaster ownership verification and sitemap submission",
      "Real Cookiebot regional/TCF consent checks and advertising-provider approval",
      "Continuous scheduler, delivered operational alerts and retained off-machine daily backups",
      "Seven real uninterrupted staging CSP days and owner review",
      "Current protected-staging mobile measurements and all AC-1 through AC-22 owner sign-off",
    ],
  };
  await mkdir(".local", { recursive: true, mode: 0o700 });
  await writeFile(
    ".local/release-readiness.json",
    JSON.stringify(report, null, 2),
    { mode: 0o600 },
  );
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = 1; // External evidence is required; never claim launch approval from configuration alone.
}
main()
  .catch(() => {
    console.error(
      "Release check failed; inspect configuration privately. No launch approval recorded.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
