import { afterEach, describe, it, expect, vi } from "vitest";
import {
  postSchema,
  serializeJsonLd,
  pageMetadata,
  paginationPath,
  countryCode,
} from "./seo";
import type { FullPost } from "./publishing";
import {
  adConfigurationError,
  advertisingInput,
  defaultSlots,
} from "./ad-policy";
import { cspPolicy, policyHash, stagingEvidenceValid } from "./csp";
import { splitBodyForAds } from "./render-body";
afterEach(() => vi.unstubAllEnvs());
const now = new Date("2026-11-17T10:00:00Z");
const post = {
  id: 1,
  slug: "example-job",
  title: "Welder",
  body: "<p>Weld equipment in a workshop.</p>",
  excerpt: "Workshop position",
  status: "PUBLISHED",
  contentType: "JOB",
  noindex: false,
  deletedAt: null,
  publishedAt: new Date("2026-11-16T10:00:00Z"),
  updatedAt: now,
  author: { name: "Editor" },
  featuredMedia: null,
  jobDetails: {
    employerName: "Example employer",
    location: "Karachi",
    country: "Pakistan",
    workplaceType: "On-site",
    employmentType: "Full-time",
    jobStatus: "OPEN",
    closingDate: new Date("2026-11-20T10:00:00Z"),
    applicationUrl: "https://example.com/jobs",
    sourceUrl: "https://example.com/jobs",
    linkAttestedAt: now,
    linkAttestedBy: "1",
    salaryMin: 100,
    salaryMax: 200,
    salaryCurrency: "USD",
    salaryPeriod: "MONTH",
  },
} as unknown as FullPost;
describe("search schema", () => {
  it("emits matching job data without extending the deadline", () => {
    const schema = postSchema(post, now);
    expect(schema?.["@type"]).toBe("JobPosting");
    expect(schema).toMatchObject({
      validThrough: "2026-11-20T10:00:00.000Z",
      jobLocation: {
        address: { addressCountry: "PK", addressLocality: "Karachi" },
      },
      employmentType: "FULL_TIME",
    });
  });
  it("omits closed, invalid, private, and noindex job schema", () => {
    expect(postSchema(post, new Date("2026-11-21"))).toBeNull();
    expect(
      postSchema(
        { ...post, jobDetails: { ...post.jobDetails!, jobStatus: "FILLED" } },
        now,
      ),
    ).toBeNull();
    expect(postSchema({ ...post, status: "SCHEDULED" }, now)).toBeNull();
    expect(postSchema({ ...post, noindex: true }, now)).toBeNull();
    expect(
      postSchema(
        {
          ...post,
          jobDetails: { ...post.jobDetails!, country: "Unknown country" },
        },
        now,
      ),
    ).toBeNull();
  });
  it("separates Article from JobPosting and handles fully remote eligibility", () => {
    expect(
      postSchema({ ...post, contentType: "ARTICLE", jobDetails: null }, now)?.[
        "@type"
      ],
    ).toBe("Article");
    const remote = postSchema(
      { ...post, jobDetails: { ...post.jobDetails!, workplaceType: "Remote" } },
      now,
    );
    expect(remote).toMatchObject({
      jobLocationType: "TELECOMMUTE",
      applicantLocationRequirements: { name: "PK" },
    });
    expect(remote).not.toHaveProperty("jobLocation");
  });
  it("escapes script boundaries in JSON-LD", () => {
    const result = serializeJsonLd({
      name: "</script><script>alert(1)</script>",
    });
    expect(result).not.toContain("<");
    expect(JSON.parse(result).name).toContain("</script>");
  });
  it("uses canonical pagination, social cards, and complete descriptions", () => {
    vi.stubEnv("APP_ENV", "production");
    const metadata = pageMetadata({
      title: "A useful title",
      description: "Short copy",
      path: "/category/pakistan?page=2",
    });
    expect((metadata.description ?? "").length).toBeGreaterThanOrEqual(140);
    expect((metadata.description ?? "").length).toBeLessThanOrEqual(160);
    expect(metadata.alternates?.canonical).toContain("?page=2");
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    expect(paginationPath("/", { page: "2" }).path).toBe("/?page=2");
    expect(countryCode("United States")).toBe("US");
  });
  it("preserves complete nested HTML around ad insertions", () => {
    const html =
      "<h2>Overview</h2><p>First paragraph.</p><table><tbody><tr><td><p>Cell text</p></td></tr></tbody></table><p>Last paragraph.</p>";
    const parts = splitBodyForAds(html);
    expect(parts.first).toContain("First paragraph.");
    expect(parts.rest).toContain("<table>");
    expect(parts.beforeMiddle + parts.afterMiddle).toBe(parts.rest);
  });
});
describe("advertising and security guards", () => {
  const config = advertisingInput.parse({
    ads_mode: "placeholder",
    publisher_id: "",
    cookiebot_id: "",
    ga4_id: "",
    slots: defaultSlots,
  });
  it("restricts placeholders to staging and requires approval for live ads", () => {
    expect(adConfigurationError(config, { APP_ENV: "production" })).toContain(
      "staging",
    );
    expect(adConfigurationError(config, { APP_ENV: "local" })).toContain(
      "staging",
    );
    expect(adConfigurationError(config, { APP_ENV: "staging" })).toBeNull();
    expect(
      adConfigurationError(
        { ...config, ads_mode: "live" },
        { APP_ENV: "production" },
      ),
    ).toContain("approval");
  });
  it("rejects pasted scripts and unsupported ad dimensions", () => {
    expect(() =>
      advertisingInput.parse({ ...config, script: "<script>evil()</script>" }),
    ).toThrow();
    expect(() =>
      advertisingInput.parse({ ...config, publisher_id: "javascript:evil()" }),
    ).toThrow();
    expect(() =>
      advertisingInput.parse({
        ...config,
        slots: config.slots.map((slot) => ({
          ...slot,
          sizes: { mobile: [320, 600], desktop: [300, 250] },
        })),
      }),
    ).toThrow();
  });
  it("creates a stable policy hash across fresh nonces without unsafe inline scripts", () => {
    const source = { NODE_ENV: "production", SITE_URL: "https://example.com" };
    const a = cspPolicy("one", source),
      b = cspPolicy("two", source);
    expect(policyHash(a)).toBe(policyHash(b));
    expect(a.split("script-src ")[1].split(";")[0]).not.toContain(
      "unsafe-inline",
    );
    expect(a).not.toContain("unsafe-eval");
    expect(cspPolicy("nonce", { NODE_ENV: "development" })).toContain(
      "unsafe-eval",
    );
    expect(stagingEvidenceValid(undefined, policyHash(a))).toBe(false);
  });
});
