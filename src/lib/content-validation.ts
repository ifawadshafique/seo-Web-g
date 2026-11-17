import sanitizeHtml from "sanitize-html";
import { z } from "zod";

export const reservedSlugs = new Set([
  "admin",
  "api",
  "category",
  "tag",
  "search",
  "sitemap",
  "robots",
  "feed",
  "ads",
  "login",
  "contact",
  "thank-you",
  "media",
  "_next",
  "404",
  "report",
  "sitemaps",
]);
export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(75)
  .refine((value) => !reservedSlugs.has(value), "This URL is reserved");
export const httpsUrl = z
  .string()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Use an HTTPS URL without credentials");
export const optionalUrl = z.union([httpsUrl, z.literal("")]).default("");
export function cleanBody(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "h2",
      "h3",
      "h4",
      "strong",
      "em",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "hr",
      "br",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "a",
      "img",
    ],
    allowedAttributes: {
      a: ["href", "title", "rel"],
      img: ["src", "alt", "width", "height"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["https"],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "nofollow noopener noreferrer",
      }),
    },
    exclusiveFilter: (frame) =>
      frame.tag === "img" &&
      (!frame.attribs.alt?.trim() ||
        !/^\/api\/media\/[a-f0-9-]+\.webp$/.test(frame.attribs.src ?? "")),
  });
}
export const plainText = (html: string) =>
  sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export const wordCount = (html: string) =>
  plainText(html).split(/\s+/).filter(Boolean).length;
export {
  scamNotice,
  jobTemplate,
  fromSiteTime,
  toSiteTime,
} from "./content-shared";
const jobSchema = z
  .object({
    employerName: z.string().max(200).default(""),
    location: z.string().max(200).default(""),
    country: z.string().max(100).default(""),
    workplaceType: z.enum(["On-site", "Remote", "Hybrid"]).default("On-site"),
    employmentType: z.string().max(100).default(""),
    salaryMin: z.number().nonnegative().finite().nullable().default(null),
    salaryMax: z.number().nonnegative().finite().nullable().default(null),
    salaryCurrency: z.string().max(3).default(""),
    salaryPeriod: z
      .enum(["", "HOUR", "DAY", "WEEK", "MONTH", "YEAR"])
      .default(""),
    closingDate: z.string().default(""),
    jobStatus: z.enum(["OPEN", "EXPIRED", "FILLED"]).default("OPEN"),
    applicationUrl: optionalUrl,
    sourceUrl: optionalUrl,
    attested: z.boolean().default(false),
  })
  .superRefine((job, ctx) => {
    if (
      job.salaryMin !== null &&
      job.salaryMax !== null &&
      job.salaryMax < job.salaryMin
    )
      ctx.addIssue({
        code: "custom",
        path: ["salaryMax"],
        message: "Maximum salary must be at least the minimum",
      });
    if (
      (job.salaryMin !== null || job.salaryMax !== null) &&
      (!/^[A-Z]{3}$/.test(job.salaryCurrency) || !job.salaryPeriod)
    )
      ctx.addIssue({
        code: "custom",
        path: ["salaryCurrency"],
        message: "Supply a three-letter currency and pay period",
      });
  });
export const postInput = z.object({
  title: z.string().trim().min(1).max(200),
  slug: slugSchema,
  contentType: z.enum(["JOB", "ARTICLE"]),
  body: z.string().max(500000),
  excerpt: z.string().max(500).default(""),
  categoryId: z.number().int().positive(),
  tagIds: z.array(z.number().int().positive()).max(30).default([]),
  featuredMediaId: z.number().int().positive().nullable().default(null),
  ogMediaId: z.number().int().positive().nullable().default(null),
  metaTitle: z.string().max(200).default(""),
  metaDescription: z.string().max(500).default(""),
  canonicalUrl: optionalUrl,
  noindex: z.boolean().default(false),
  adsEnabled: z.boolean().default(false),
  status: z
    .enum(["DRAFT", "SCHEDULED", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"])
    .default("DRAFT"),
  scheduledLocal: z.string().default(""),
  job: jobSchema.optional(),
  confirmShort: z.boolean().default(false),
});
export type PostInput = z.infer<typeof postInput>;
export function publicationErrors(data: PostInput, role: string) {
  const errors: string[] = [];
  if (!["PUBLISHED", "SCHEDULED"].includes(data.status)) return errors;
  if (!plainText(data.body)) errors.push("Add post content before publishing");
  if (wordCount(data.body) < 400 && !(data.confirmShort && role === "ADMIN"))
    errors.push(
      "An admin must confirm publishing content shorter than 400 words",
    );
  if (
    /\bguaranteed\b|100\s*%\s*visa/i.test(
      plainText(data.body) + " " + data.title,
    )
  )
    errors.push("Remove guaranteed job, visa, or salary promises");
  if (data.contentType === "JOB") {
    const job = data.job;
    if (
      !job?.employerName.trim() ||
      !job.location.trim() ||
      !job.country.trim() ||
      !job.employmentType.trim() ||
      !job.applicationUrl ||
      !job.sourceUrl ||
      !job.attested
    )
      errors.push(
        "Jobs require employer, location, country, employment type, HTTPS source and application links, and source attestation",
      );
  }
  return errors;
}
