import { Suspense } from "react";
/* eslint-disable @next/next/no-html-link-for-pages -- Public links use full server navigation to limit hydration work on low-end devices. */
import { imageUrl } from "@/lib/image-url";
import { AdPlacement } from "./ad-placement";
import { wordCount } from "@/lib/content-validation";
import { optimizeBodyImages, splitBodyForAds } from "@/lib/render-body";
import { JsonLd } from "./json-ld";
import { postSchema, breadcrumbSchema } from "@/lib/seo";
import { OptimizedImage as Image } from "./optimized-image";
import { FullPost } from "@/lib/publishing";
import { cleanBody } from "@/lib/content-validation";
import { scamNotice } from "@/lib/content-shared";
import { ui } from "@/lib/ui-text";
import { ShareButtons } from "./share-buttons";
export function PostView({
  post,
  timezone = "Asia/Karachi",
  preview = false,
}: {
  post: FullPost;
  timezone?: string;
  preview?: boolean;
}) {
  const format = (date: Date) =>
    new Intl.DateTimeFormat("en", {
      dateStyle: "long",
      timeZone: timezone,
    }).format(date);
  const job = post.jobDetails;
  const expired =
    job &&
    (job.jobStatus !== "OPEN" ||
      (job.closingDate && job.closingDate <= new Date()));
  const html = cleanBody(post.body);
  const parts = splitBodyForAds(html);
  const long = wordCount(html) > 800;
  const url =
    (process.env.SITE_URL ?? "http://localhost:3000") + "/" + post.slug;
  return (
    <article className="post-detail">
      {!preview && (
        <>
          <JsonLd value={postSchema(post)} />
          <JsonLd
            value={breadcrumbSchema([
              { name: ui.home, path: "/" },
              {
                name: post.category.name,
                path: "/category/" + post.category.slug,
              },
              { name: post.title, path: "/" + post.slug },
            ])}
          />
        </>
      )}
      {preview && <p className="warning">{ui.previewNotice}</p>}
      <nav className="breadcrumbs">
        <a href="/">{ui.home}</a>
        <span>/</span>
        <a href={`/category/${post.category.slug}`}>{post.category.name}</a>
        <span>/</span>
        <span>{post.title}</span>
      </nav>
      <div className="detail-heading">
        <span className="eyebrow">
          {post.contentType === "JOB" ? post.category.name : "Career journal"}
        </span>
        <h1>{post.title}</h1>
        <p className="detail-excerpt">{post.excerpt}</p>
        <div className="detail-meta">
          <span>{post.author.name}</span>
          {post.publishedAt && (
            <span>
              {ui.published}{" "}
              <time dateTime={post.publishedAt.toISOString()}>
                {format(post.publishedAt)}
              </time>
            </span>
          )}
          <span>
            {ui.updated}{" "}
            <time dateTime={post.updatedAt.toISOString()}>
              {format(post.updatedAt)}
            </time>
          </span>
        </div>
      </div>
      {post.featuredMedia && (
        <Image
          className="detail-image"
          src={imageUrl(post.featuredMedia.url)}
          alt={post.featuredMedia.altText}
          width={post.featuredMedia.width}
          height={post.featuredMedia.height}
          sizes="(max-width: 900px) 100vw, 900px"
          preload
        />
      )}
      {job && (
        <section className="job-summary">
          <div>
            <small>Employer</small>
            <strong>{job.employerName}</strong>
          </div>
          <div>
            <small>Location</small>
            <strong>
              {job.location}, {job.country}
            </strong>
          </div>
          <div>
            <small>Employment</small>
            <strong>
              {job.employmentType} · {job.workplaceType}
            </strong>
          </div>
          {(job.salaryMin !== null || job.salaryMax !== null) && (
            <div>
              <small>Salary</small>
              <strong>
                {job.salaryMin !== null
                  ? job.salaryMin.toLocaleString()
                  : "Up to "}
                {job.salaryMax !== null
                  ? `${job.salaryMin !== null ? "–" : ""}${job.salaryMax.toLocaleString()}`
                  : ""}{" "}
                {job.salaryCurrency} / {job.salaryPeriod?.toLowerCase()}
              </strong>
            </div>
          )}
          {job.closingDate && (
            <div>
              <small>Closing date</small>
              <strong>{format(job.closingDate)}</strong>
            </div>
          )}
          <div>
            <small>Status</small>
            <strong>{expired ? "Closed" : job.jobStatus}</strong>
          </div>
        </section>
      )}
      {expired && <p className="warning">{ui.closed}</p>}
      <div className="rich-content article-body">
        <div
          dangerouslySetInnerHTML={{ __html: optimizeBodyImages(parts.first) }}
        />
        {!preview && <AdPlacement name="in-article-1" />}
        {long ? (
          <>
            <div
              dangerouslySetInnerHTML={{
                __html: optimizeBodyImages(parts.beforeMiddle),
              }}
            />
            {!preview && <AdPlacement name="in-article-2" />}
            <div
              dangerouslySetInnerHTML={{
                __html: optimizeBodyImages(parts.afterMiddle),
              }}
            />
          </>
        ) : (
          <div
            dangerouslySetInnerHTML={{ __html: optimizeBodyImages(parts.rest) }}
          />
        )}
      </div>
      {!preview && <AdPlacement name="end-of-post" />}
      {job && (
        <>
          <aside className="scam-notice">
            <h2>{ui.scam}</h2>
            <p>{scamNotice}</p>
          </aside>
          <div className="apply-links">
            {!expired && (
              <a
                className="button"
                data-apply-link="true"
                href={job.applicationUrl}
                rel="nofollow noopener noreferrer"
                target="_blank"
              >
                {ui.apply} ↗
              </a>
            )}
            <a
              href={job.sourceUrl}
              target="_blank"
              rel="nofollow noopener noreferrer"
            >
              {ui.source} ↗
            </a>
          </div>
        </>
      )}
      <div className="job-chips">
        {post.tags.map((link) => (
          <a href={`/tag/${link.tag.slug}`} key={link.tag.id}>
            {link.tag.name}
          </a>
        ))}
      </div>
      {job && !preview && (
        <a className="report-link" href={"/report/" + post.slug}>
          Report this listing
        </a>
      )}
      <Suspense fallback={null}>
        <ShareButtons url={url} title={post.title} />
      </Suspense>
    </article>
  );
}
