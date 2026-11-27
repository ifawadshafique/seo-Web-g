/* eslint-disable @next/next/no-html-link-for-pages -- Public links use full server navigation to limit hydration work on low-end devices. */
import { Fragment } from "react";
import { AdPlacement } from "./ad-placement";
import { JsonLd } from "./json-ld";
import { breadcrumbSchema } from "@/lib/seo";
import { browsePosts, param, postsPerPage, SearchParams } from "@/lib/browse";
import { effectiveJobStatus } from "@/lib/content-shared";
import type { FullPost } from "@/lib/publishing";
import { savedJobSlugs } from "@/lib/saved-jobs";
import { SaveJobButton } from "./save-job-button";
import { OptimizedImage } from "./optimized-image";
import { imageUrl } from "@/lib/image-url";
import { ui } from "@/lib/ui-text";
import { notFound } from "next/navigation";
export async function Listing({
  params = {},
  scope,
  title,
  intro,
  path = "/",
  hero = false,
}: {
  params?: SearchParams;
  scope?: { category?: string; tag?: string };
  title?: string;
  intro?: string | null;
  path?: string;
  hero?: boolean;
}) {
  const result = await browsePosts(params, scope);
  const jobsPage = path === "/search";
  if (result.page > 1 && !result.posts.length) notFound();
  const saved = await savedJobSlugs(
    result.posts
      .filter((post) => post.contentType === "JOB")
      .map((post) => post.slug),
  );
  const firstPage = Math.max(
    1,
    Math.min(result.page - 2, result.totalPages - 4),
  );
  const pageNumbers = Array.from(
    { length: Math.min(result.totalPages, 5) },
    (_, index) => firstPage + index,
  );
  const href = (page: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params))
      if (typeof value === "string" && key !== "page" && value)
        query.set(key, value);
    if (page > 1) query.set("page", String(page));
    return path + (query.size ? "?" + query : "");
  };
  return (
    <main
      className={`public-main${hero ? " portal-home" : jobsPage ? " portal-jobs" : ""}`}
    >
      {scope && (
        <JsonLd
          value={breadcrumbSchema([
            { name: ui.home, path: "/" },
            { name: title ?? ui.search, path },
          ])}
        />
      )}
      {hero ? (
        <section className="hero">
          <h1>Find your next job</h1>
          <p>Explore job opportunities around the world.</p>
        </section>
      ) : jobsPage ? (
        <section className="portal-jobs-heading">
          <h1>Jobs</h1>
        </section>
      ) : (
        <section className="listing-heading">
          <nav className="breadcrumbs">
            <a href="/">{ui.home}</a>
            <span>/</span>
            <span>{title}</span>
          </nav>
          <h1>{title ?? ui.search}</h1>
          {result.page === 1 && intro && <p className="hub-intro">{intro}</p>}
        </section>
      )}
      {jobsPage ? (
        <aside
          className="portal-jobs-filters"
          aria-labelledby="job-filters-heading"
        >
          <h2 id="job-filters-heading">Filter jobs</h2>
          <form action="/search">
            <label>
              Job title or keyword
              <input
                name="q"
                defaultValue={param(params, "q")}
                placeholder="e.g. Kitchen assistant"
              />
            </label>
            <label>
              Country
              <select name="country" defaultValue={param(params, "country")}>
                <option value="">All countries</option>
                {result.countries.map((country) => (
                  <option key={country}>{country}</option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select name="category" defaultValue={param(params, "category")}>
                <option value="">All categories</option>
                {result.categories.map(({ slug, name }) => (
                  <option key={slug} value={slug}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {result.tags.length > 0 && (
              <label>
                Job type
                <select name="tag" defaultValue={param(params, "tag")}>
                  <option value="">All job types</option>
                  {result.tags.map(({ slug, name }) => (
                    <option key={slug} value={slug}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Date posted
              <select name="posted" defaultValue={param(params, "posted")}>
                <option value="">Any date</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </label>
            <label>
              Sort by
              <select name="sort" defaultValue={param(params, "sort")}>
                <option value="">Latest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
            <button className="button">Apply filters</button>
            <a href="/search">Clear filters</a>
          </form>
        </aside>
      ) : (
        <SearchForm
          params={params}
          countries={result.countries}
          tags={result.tags}
        />
      )}
      {hero && (
        <nav className="portal-shortcuts" aria-label="Explore Workboard">
          <a href="/search">Browse jobs</a>
          <a href="/about">About Workboard</a>
          <a href="/contact">Post a job</a>
        </nav>
      )}
      <section className="listing-section directory-listing">
        <div className="section-heading">
          <div>
            <h2>{hero ? "Recent jobs and articles" : "Search results"}</h2>
            <p>
              {jobsPage && result.total
                ? `Showing ${(result.page - 1) * postsPerPage + 1}–${(result.page - 1) * postsPerPage + result.posts.length} of ${result.total} results`
                : `${result.total} results${result.totalPages > 1 ? ` · Page ${result.page} of ${result.totalPages}` : ""}`}
            </p>
          </div>
          {hero && (
            <a className="portal-view-all" href="/search">
              View all
            </a>
          )}
        </div>
        {!result.posts.length ? (
          <div className="empty-state">
            <p>{ui.empty}</p>
          </div>
        ) : (
          <div className="directory-results">
            {result.posts.map((post, index) => (
              <Fragment key={post.id}>
                <ListingRow post={post} saved={saved.has(post.slug)} />
                {(index + 1) % 6 === 0 && (
                  <div className="in-feed-ad">
                    <AdPlacement name="in-feed" />
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        )}
        <nav className="pagination" aria-label="Pagination">
          {result.page > 1 && (
            <a className="button secondary" href={href(result.page - 1)}>
              ← {ui.previous}
            </a>
          )}
          {result.totalPages > 1 &&
            pageNumbers.map((page) => (
              <a
                key={page}
                className={page === result.page ? "button" : "button secondary"}
                href={href(page)}
                aria-label={`Page ${page}`}
                aria-current={page === result.page ? "page" : undefined}
              >
                {page}
              </a>
            ))}
          {result.page < result.totalPages && (
            <a className="button secondary" href={href(result.page + 1)}>
              {ui.next} →
            </a>
          )}
        </nav>
      </section>
      {hero && result.categories.length > 0 && (
        <section className="category-section">
          <h2>Browse by category</h2>
          <div className="category-links">
            {result.categories.map((term) => (
              <a href={`/category/${term.slug}`} key={term.id}>
                {term.name} <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </section>
      )}
      {hero && (
        <section className="portal-employer">
          <h2>Hiring for your team?</h2>
          <p>Send us the vacancy details and application link for review.</p>
          <a className="button" href="/contact">
            Submit a job
          </a>
        </section>
      )}
    </main>
  );
}

const listingDate = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: process.env.SITE_TIMEZONE ?? "Asia/Karachi",
});
const salaryNumber = new Intl.NumberFormat("en");

export function ListingRow({
  post,
  saved = false,
}: {
  post: FullPost;
  saved?: boolean;
}) {
  const job = post.jobDetails;
  const location = [
    ...new Set([job?.location, job?.country].filter(Boolean)),
  ].join(", ");
  const salary = [job?.salaryMin, job?.salaryMax]
    .filter((amount): amount is number => amount != null)
    .map((amount) => salaryNumber.format(amount))
    .join("–");
  return (
    <article className="directory-row post-card">
      <div className="directory-row-content">
        <h3>
          <a href={`/${post.slug}`}>{post.title}</a>
        </h3>
        <p className="directory-employer">
          {job?.employerName || post.category.name}
        </p>
        {job && (
          <ul className="directory-facts">
            {location && <li>{location}</li>}
            {job.employmentType && <li>{job.employmentType}</li>}
            {salary && (
              <li>
                {job.salaryCurrency} {job.salaryMin == null && "Up to "}
                {salary}
                {job.salaryPeriod && ` / ${job.salaryPeriod.toLowerCase()}`}
              </li>
            )}
            {job.closingDate && (
              <li>
                Closes{" "}
                <time dateTime={job.closingDate.toISOString()}>
                  {listingDate.format(job.closingDate)}
                </time>
              </li>
            )}
            {effectiveJobStatus(job) !== "OPEN" && <li>Closed</li>}
          </ul>
        )}
        {!job && post.excerpt && (
          <p className="directory-article-excerpt">{post.excerpt}</p>
        )}
        {post.publishedAt && (
          <time
            className="directory-date"
            dateTime={post.publishedAt.toISOString()}
          >
            Posted {listingDate.format(post.publishedAt)}
          </time>
        )}
      </div>
      <div className="directory-row-actions">
        {post.featuredMedia && (
          <OptimizedImage
            className="directory-thumbnail"
            src={imageUrl(post.featuredMedia.url)}
            alt={post.featuredMedia.altText}
            width={post.featuredMedia.width}
            height={post.featuredMedia.height}
            sizes="132px"
          />
        )}
        <div className="directory-row-buttons">
          {post.contentType === "JOB" && (
            <SaveJobButton
              key={`${post.slug}:${saved}`}
              slug={post.slug}
              initialSaved={saved}
            />
          )}
          <a
            className="button secondary directory-details"
            href={`/${post.slug}`}
            aria-label={`${job ? "Job details" : "Read article"}: ${post.title}`}
          >
            {job ? "Job details" : "Read article"}
          </a>
        </div>
      </div>
    </article>
  );
}

export function SearchForm({
  params = {},
  countries = [],
  tags = [],
}: {
  params?: SearchParams;
  countries?: string[];
  tags?: { id: number; name: string; slug: string }[];
}) {
  return (
    <form className="public-search" action="/search">
      <label>
        <span>{ui.search}</span>
        <input
          name="q"
          defaultValue={param(params, "q")}
          placeholder={ui.searchPlaceholder}
        />
      </label>
      <label>
        <span>Country</span>
        <select name="country" defaultValue={param(params, "country")}>
          <option value="">{ui.allCountries}</option>
          {countries.map((country) => (
            <option key={country}>{country}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Job type</span>
        <select name="tag" defaultValue={param(params, "tag")}>
          <option value="">{ui.allTypes}</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.slug}>
              {tag.name}
            </option>
          ))}
        </select>
      </label>
      <button className="button">{ui.search} ↗</button>
    </form>
  );
}
