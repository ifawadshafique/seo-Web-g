/* eslint-disable @next/next/no-html-link-for-pages -- Public links use full server navigation to limit hydration work on low-end devices. */
import { Fragment } from "react";
import { AdPlacement } from "./ad-placement";
import { JsonLd } from "./json-ld";
import { breadcrumbSchema } from "@/lib/seo";
import { browsePosts, param, SearchParams } from "@/lib/browse";
import { PostCard } from "./post-card";
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
  if (result.page > 1 && !result.posts.length) notFound();
  const href = (page: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params))
      if (typeof value === "string" && key !== "page" && value)
        query.set(key, value);
    if (page > 1) query.set("page", String(page));
    return path + (query.size ? "?" + query : "");
  };
  return (
    <main className="public-main">
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
          <p className="eyebrow">A clearer path to your next role</p>
          <h1>
            {ui.jobs}
            <span>Start with the details.</span>
          </h1>
          <p>{ui.intro}</p>
          <SearchForm
            params={params}
            countries={result.countries}
            tags={result.tags}
          />
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
          <SearchForm
            params={params}
            countries={result.countries}
            tags={result.tags}
          />
        </section>
      )}
      <section className="listing-section">
        <div className="section-heading">
          <h2>{hero ? ui.latest : ui.search}</h2>
          <p>
            {result.total} results · {result.page}
          </p>
        </div>
        {!result.posts.length ? (
          <div className="empty-state">
            <p>{ui.empty}</p>
          </div>
        ) : (
          <div className="post-grid">
            {result.posts.map((post, index) => (
              <Fragment key={post.id}>
                <PostCard post={post} />
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
          {result.page * 12 < result.total && (
            <a className="button secondary" href={href(result.page + 1)}>
              {ui.next} →
            </a>
          )}
        </nav>
      </section>
      {hero && result.categories.length > 0 && (
        <section className="category-section">
          <h2>Explore by category</h2>
          <div className="category-links">
            {result.categories.map((term) => (
              <a href={`/category/${term.slug}`} key={term.id}>
                {term.name} ↗
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
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
