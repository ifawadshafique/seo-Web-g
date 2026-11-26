import type { Metadata } from "next";
import countries from "i18n-iso-countries";
import english from "i18n-iso-countries/langs/en.json";
import type { FullPost } from "./publishing";
import { cleanBody, plainText } from "./content-validation";
import { publicIndexingEnabled } from "./public-indexing";
countries.registerLocale(english);
export function siteOrigin() {
  return new URL(process.env.SITE_URL ?? "http://localhost:3000").origin;
}
export const absoluteUrl = (path: string) =>
  new URL(path, siteOrigin()).toString();
export function metaTitle(value: string) {
  return value.trim().slice(0, 60);
}
export function metaDescription(value: string, title: string) {
  let text = plainText(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
  if (text.length < 140)
    text = `${title}. ${text} Explore the full details, read the requirements, check the source, and find more job opportunities and career guidance.`;
  while (text.length < 140) text += " Browse the latest updates.";
  return text.slice(0, 160).trimEnd();
}
export function pageMetadata({
  title,
  description,
  path,
  index = true,
  image,
  verification,
}: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  image?: string;
  verification?: { google?: string; other?: Record<string, string> };
}): Metadata {
  const url = absoluteUrl(path),
    share = image ?? absoluteUrl("/api/og");
  return {
    title: metaTitle(title),
    description: metaDescription(description, title),
    metadataBase: new URL(siteOrigin()),
    alternates: { canonical: url },
    robots: {
      index: index && publicIndexingEnabled(),
      follow: true,
    },
    openGraph: {
      type: "website",
      title: metaTitle(title),
      description: metaDescription(description, title),
      url,
      images: [{ url: share, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle(title),
      description: metaDescription(description, title),
      images: [share],
    },
    verification,
  };
}
export const serializeJsonLd = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
export function countryCode(value: string | null) {
  if (!value) return undefined;
  const code =
    countries.getAlpha2Code(value.trim(), "en") ??
    (countries.isValid(value.trim().toUpperCase())
      ? countries.toAlpha2(value.trim().toUpperCase())
      : undefined);
  return code;
}
const employment: Record<string, string> = {
  "FULL-TIME": "FULL_TIME",
  "FULL TIME": "FULL_TIME",
  FULL_TIME: "FULL_TIME",
  "PART-TIME": "PART_TIME",
  "PART TIME": "PART_TIME",
  PART_TIME: "PART_TIME",
  CONTRACT: "CONTRACTOR",
  CONTRACTOR: "CONTRACTOR",
  TEMPORARY: "TEMPORARY",
  INTERN: "INTERN",
  VOLUNTEER: "VOLUNTEER",
  PER_DIEM: "PER_DIEM",
  OTHER: "OTHER",
};
export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
export function postSchema(post: FullPost, now = new Date()) {
  if (
    post.status !== "PUBLISHED" ||
    post.deletedAt ||
    !post.publishedAt ||
    post.publishedAt > now ||
    post.noindex
  )
    return null;
  const url = absoluteUrl("/" + post.slug);
  if (post.contentType === "ARTICLE")
    return {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.excerpt ?? undefined,
      datePublished: post.publishedAt.toISOString(),
      dateModified: post.updatedAt.toISOString(),
      author: { "@type": "Person", name: post.author.name },
      mainEntityOfPage: url,
      ...(post.featuredMedia
        ? { image: absoluteUrl(post.featuredMedia.url) }
        : {}),
    };
  const job = post.jobDetails,
    code = countryCode(job?.country ?? null);
  if (
    !job ||
    job.jobStatus !== "OPEN" ||
    (job.closingDate && job.closingDate <= now) ||
    !job.employerName.trim() ||
    !job.location?.trim() ||
    !code ||
    !job.linkAttestedAt ||
    !job.linkAttestedBy ||
    !/^https:\/\//.test(job.applicationUrl) ||
    !/^https:\/\//.test(job.sourceUrl) ||
    !plainText(post.body)
  )
    return null;
  const remote = job.workplaceType === "Remote";
  const salary = job.salaryMin !== null || job.salaryMax !== null;
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: post.title,
    description: cleanBody(post.body),
    datePosted: post.publishedAt.toISOString(),
    ...(job.closingDate ? { validThrough: job.closingDate.toISOString() } : {}),
    hiringOrganization: { "@type": "Organization", name: job.employerName },
    url,
    ...(employment[job.employmentType?.toUpperCase() ?? ""]
      ? { employmentType: employment[job.employmentType!.toUpperCase()] }
      : {}),
    ...(remote
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: { "@type": "Country", name: code },
        }
      : {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: job.location,
              addressCountry: code,
            },
          },
        }),
    ...(salary &&
    /^[A-Z]{3}$/.test(job.salaryCurrency ?? "") &&
    ["HOUR", "DAY", "WEEK", "MONTH", "YEAR"].includes(job.salaryPeriod ?? "")
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: job.salaryCurrency,
            value: {
              "@type": "QuantitativeValue",
              ...(job.salaryMin !== null ? { minValue: job.salaryMin } : {}),
              ...(job.salaryMax !== null ? { maxValue: job.salaryMax } : {}),
              unitText: job.salaryPeriod,
            },
          },
        }
      : {}),
  };
}
export function organizationSchema(name: string, logo?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: siteOrigin(),
    ...(logo ? { logo: absoluteUrl(logo) } : {}),
  };
}
export function paginationPath(
  path: string,
  params: Record<string, string | string[] | undefined>,
) {
  const raw = Number(typeof params.page === "string" ? params.page : 1);
  const page = Number.isSafeInteger(raw) && raw > 0 && raw <= 100000 ? raw : 1;
  return { page, path: path + (page > 1 ? `?page=${page}` : "") };
}
