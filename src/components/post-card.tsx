import { effectiveJobStatus } from "@/lib/content-shared";
import { imageUrl } from "@/lib/image-url";
import { OptimizedImage as Image } from "./optimized-image";
import { FullPost } from "@/lib/publishing";
import { ui } from "@/lib/ui-text";
export function PostCard({ post }: { post: FullPost }) {
  return (
    <article className="post-card">
      {post.featuredMedia ? (
        <a className="card-image" href={`/${post.slug}`}>
          <Image
            src={imageUrl(post.featuredMedia.url)}
            alt={post.featuredMedia.altText}
            width={post.featuredMedia.width}
            height={post.featuredMedia.height}
            sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
          />
        </a>
      ) : (
        <a
          href={`/${post.slug}`}
          className="card-image card-placeholder"
          aria-label={post.title}
        >
          <span aria-hidden="true">
            {post.contentType === "JOB" ? "↗" : "Aa"}
          </span>
          <small aria-hidden="true">{post.category.name}</small>
        </a>
      )}
      <div className="card-content">
        <div className="card-meta">
          <a href={`/category/${post.category.slug}`}>{post.category.name}</a>
          <span>
            {post.contentType === "JOB"
              ? post.jobDetails
                ? effectiveJobStatus(post.jobDetails)
                : "JOB"
              : "ARTICLE"}
          </span>
        </div>
        <h2>
          <a href={`/${post.slug}`}>{post.title}</a>
        </h2>
        <p className="card-excerpt">{post.excerpt}</p>
        {post.jobDetails && (
          <div className="job-chips">
            <span>{post.jobDetails.country}</span>
            <span>{post.jobDetails.employmentType}</span>
          </div>
        )}
        <div className="card-bottom">
          <time dateTime={post.publishedAt?.toISOString()}>
            {post.publishedAt &&
              new Intl.DateTimeFormat("en", {
                dateStyle: "medium",
                timeZone: process.env.SITE_TIMEZONE ?? "Asia/Karachi",
              }).format(post.publishedAt)}
          </time>
          <a href={`/${post.slug}`}>{ui.read} ↗</a>
        </div>
      </div>
    </article>
  );
}
