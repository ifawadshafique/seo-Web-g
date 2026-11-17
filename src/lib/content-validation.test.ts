import { describe, it, expect } from "vitest";
import {
  cleanBody,
  fromSiteTime,
  postInput,
  publicationErrors,
  slugSchema,
  toSiteTime,
} from "./content-validation";
const article = {
  title: "A useful career article",
  slug: "useful-career-article",
  contentType: "ARTICLE",
  categoryId: 1,
  body: "<p>Short article.</p>",
  status: "PUBLISHED",
  confirmShort: true,
};
describe("publishing validation", () => {
  it("strips executable HTML and unsafe links while keeping allowed formatting", () => {
    const body = cleanBody(
      '<script>alert(1)</script><h1>Bad heading</h1><h2>Good heading</h2><p onclick="evil()">Read <a href="javascript:alert(1)">this</a></p><img src="https://example.com/track" alt="External"><img src="/api/media/1234-abcd.webp" alt="Description" width="600" height="300">',
    );
    expect(body).not.toMatch(/<script|onclick|javascript:|<h1|track/);
    expect(body).toContain("<h2>Good heading</h2>");
    expect(body).toContain('alt="Description"');
  });
  it("keeps drafts flexible and requires owner approval for short publication", () => {
    const data = postInput.parse({ ...article, confirmShort: false });
    expect(publicationErrors(data, "ADMIN")).toContain(
      "An admin must confirm publishing content shorter than 400 words",
    );
    expect(publicationErrors({ ...data, confirmShort: true }, "ADMIN")).toEqual(
      [],
    );
    expect(
      publicationErrors({ ...data, confirmShort: true }, "EDITOR"),
    ).not.toEqual([]);
    expect(publicationErrors({ ...data, status: "DRAFT" }, "EDITOR")).toEqual(
      [],
    );
  });
  it("requires a source attestation for jobs and blocks dangerous schemes", () => {
    const data = postInput.parse({ ...article, contentType: "JOB" });
    expect(publicationErrors(data, "ADMIN").join(" ")).toContain("attestation");
    expect(() =>
      postInput.parse({ ...article, canonicalUrl: "javascript:evil()" }),
    ).toThrow();
  });
  it("accepts empty optional URLs without throwing and rejects malformed URLs", () => {
    expect(
      postInput.parse({
        ...article,
        canonicalUrl: "",
        job: { sourceUrl: "", applicationUrl: "" },
      }).canonicalUrl,
    ).toBe("");
    expect(() =>
      postInput.parse({ ...article, canonicalUrl: "not-a-url" }),
    ).toThrow();
  });
  it("rejects salary inversions and incomplete currency information", () => {
    expect(() =>
      postInput.parse({
        ...article,
        job: {
          salaryMin: 100,
          salaryMax: 50,
          salaryCurrency: "USD",
          salaryPeriod: "YEAR",
        },
      }),
    ).toThrow();
    expect(() =>
      postInput.parse({ ...article, job: { salaryMin: 100 } }),
    ).toThrow();
  });
  it("blocks reserved URLs and false promises", () => {
    expect(() => slugSchema.parse("admin")).toThrow();
    expect(() => slugSchema.parse("contact")).toThrow();
    expect(
      publicationErrors(
        postInput.parse({ ...article, title: "Guaranteed visa" }),
        "ADMIN",
      ).join(" "),
    ).toContain("promises");
  });
  it("round-trips site-local time and rejects DST gaps", () => {
    expect(fromSiteTime("2026-11-16T14:00", "Asia/Karachi").toISOString()).toBe(
      "2026-11-16T09:00:00.000Z",
    );
    expect(toSiteTime("2026-11-16T09:00:00Z", "Asia/Karachi")).toBe(
      "2026-11-16T14:00",
    );
    expect(() =>
      fromSiteTime("2026-03-08T02:30", "America/New_York"),
    ).toThrow();
  });
});
