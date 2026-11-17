import "dotenv/config";
import prisma from "../src/lib/prisma";
import { assertSeedAllowed } from "../prisma/seed";

async function main() {
  assertSeedAllowed(
    process.env.APP_ENV ?? "local",
    process.env.DATABASE_URL ?? "",
  );
  const introduction =
    "Explore current career opportunities and take time to understand each role before applying. Every listing should explain the employer, location, requirements, and application process in clear language. Start by reading the full description and checking whether your experience fits the position. Follow the source link to review the information on the employer’s official website, a government portal, or the named recruiter’s public page. Pay attention to closing dates, employment terms, and any qualifications mentioned in the original source. Jobs and availability can change, so confirm the latest details before making plans. Never pay someone for an interview or a guaranteed offer, and avoid sharing identity documents through unverified channels. You can use the country and job type filters to narrow your search, or browse related posts to compare different options. Career articles also offer practical guidance on preparing an application, understanding a role, and asking useful questions. Use this category as a starting point for your research and make your final application directly through the published official channel.";
  await prisma.category.upsert({
    where: { slug: "career-opportunities" },
    create: {
      name: "Career opportunities",
      slug: "career-opportunities",
      description: introduction,
    },
    update: {},
  });
  for (const [name, slug] of [
    ["Full-time", "full-time"],
    ["Part-time", "part-time"],
    ["Contract", "contract"],
    ["Remote", "remote"],
  ])
    await prisma.tag.upsert({
      where: { slug },
      create: { name, slug, description: "" },
      update: {},
    });
  for (const [slug, title] of [
    ["about", "About"],
    ["contact", "Contact"],
    ["privacy-policy", "Privacy Policy"],
    ["terms", "Terms"],
    ["disclaimer", "Disclaimer"],
  ])
    await prisma.page.upsert({
      where: { slug },
      create: { slug, title, body: "", status: "DRAFT" },
      update: {},
    });
  for (const [key, value] of [
    ["site_timezone", process.env.SITE_TIMEZONE ?? "Asia/Karachi"],
    ["site_name", "Workboard"],
    ["expired_job_policy", "retain"],
  ])
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  console.log(
    "Added a starter category, standard tags, draft static pages, and local settings. Existing content preserved.",
  );
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Setup failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
