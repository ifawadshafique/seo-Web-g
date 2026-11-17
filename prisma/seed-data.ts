// prisma/seed-data.ts
/**
 * Sample data seed for local / staging environments.
 * Populates the database with a user, a category, tags, a post (article) and a job post.
 * Run with: `npx ts-node prisma/seed-data.ts`
 */
import { parseEnv } from "../src/lib/env";
import { ContentType, PostStatus, Role, JobStatus, VerificationStatus } from "@prisma/client";
import prisma from "../src/lib/prisma";

function assertSeedAllowed(appEnv: string, databaseUrl: string): void {
  if (appEnv === "production") {
    throw new Error("Refusing to seed: APP_ENV=production (ENV-4)");
  }
  if (/prod/i.test(databaseUrl)) {
    throw new Error("Refusing to seed: DATABASE_URL looks like production (ENV-4)");
  }
}

async function main() {
  const e = parseEnv(process.env);
  assertSeedAllowed(e.APP_ENV, e.DATABASE_URL);


  try {
    // ---- Settings (reuse logic from existing seed) ----
    const settings = {
      site_name: "Job Posts (sample)",
      site_timezone: e.SITE_TIMEZONE,
      ads_mode: e.ADS_MODE,
      default_meta_description: "Sample site description used on local and staging environments only.",
    } as Record<string, string>;
    for (const [key, value] of Object.entries(settings)) {
      await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    }

    // ---- User ----
    const user = await prisma.user.upsert({
      where: { email: "admin@example.com" },
      update: {},
      create: {
        name: "Admin User",
        email: "admin@example.com",
        passwordHash: "$2b$10$placeholderhash",
        role: Role.ADMIN,
        mfaEnabled: false,
        sessionVersion: 0,
      },
    });

    // ---- Category ----
    const category = await prisma.category.upsert({
      where: { slug: "technology" },
      update: {},
      create: {
        name: "Technology",
        slug: "technology",
        description: "Technology related posts.",
        metaTitle: "Technology Posts",
        metaDesc: "All tech articles and jobs.",
      },
    });

    // ---- Tags ----
    const tagsData = [
      { name: "JavaScript", slug: "javascript", description: "JS tag" },
      { name: "Remote", slug: "remote", description: "Remote work" },
    ];
    const tags: { id: number }[] = [];
    for (const t of tagsData) {
      const tag = await prisma.tag.upsert({
        where: { slug: t.slug },
        update: {},
        create: t,
      });
      tags.push(tag);
    }

    // ---- Media (placeholder image) ----
    const media = await prisma.media.create({
      data: {
        url: "https://via.placeholder.com/800x400.png",
        altText: "Placeholder image",
        width: 800,
        height: 400,
        mimeType: "image/png",
        sizeBytes: 12345,
        uploadedBy: user.id,
      },
    });

    // ---- Article Post ----
    await prisma.post.create({
      data: {
        contentType: ContentType.ARTICLE,
        title: "Introducing Our New Platform",
        slug: "introducing-our-new-platform",
        excerpt: "A brief overview of the new job posting platform.",
        body: "<p>This is a sample article used for local testing.</p>",
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        authorId: user.id,
        categoryId: category.id,
        featuredMediaId: media.id,
        metaTitle: "New Platform Launch",
        metaDescription: "Learn about the features of our new platform.",
        canonicalUrl: "https://example.com/articles/introducing-our-new-platform",
        tags: { create: tags.map((t) => ({ tagId: t.id })) },
      },
    });

    // ---- Job Post ----
    await prisma.post.create({
      data: {
        contentType: ContentType.JOB,
        title: "Senior Frontend Engineer",
        slug: "senior-frontend-engineer",
        excerpt: "Join our remote team as a Senior Frontend Engineer.",
        body: "<p>We are looking for a talented engineer...</p>",
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        authorId: user.id,
        categoryId: category.id,
        tags: { create: [{ tagId: tags[1].id }] }, // remote tag
        jobDetails: {
          create: {
            employerName: "Acme Corp",
            location: "Remote",
            country: "USA",
            workplaceType: "Remote",
            employmentType: "Full-time",
            salaryMin: 90000,
            salaryMax: 130000,
            salaryCurrency: "USD",
            salaryPeriod: "year",
            closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            jobStatus: JobStatus.OPEN,
            applicationUrl: "https://acme.example.com/careers/123",
            sourceUrl: "https://jobs.example.com/senior-frontend",
            verificationStatus: VerificationStatus.NONE,
          },
        },
      },
    });

    console.log("✅ Seeded sample data: 1 user, 1 category, " + tags.length + " tags, 1 article, 1 job post.");
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
