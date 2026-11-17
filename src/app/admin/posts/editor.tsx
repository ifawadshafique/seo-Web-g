"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RichEditor } from "@/components/rich-editor";
import { MediaPicker } from "@/components/media-picker";
import { api, MediaRecord, Term, Serialized } from "@/lib/client-api";
import type { FullPost } from "@/lib/publishing";
import type { PostInput } from "@/lib/content-validation";
import { toSiteTime, jobTemplate } from "@/lib/content-shared";
import { ui, jobFields, labels, statusLabels } from "@/lib/ui-text";
type RecordPost = Serialized<FullPost>;
const emptyJob = {
  employerName: "",
  location: "",
  country: "",
  workplaceType: "On-site" as const,
  employmentType: "",
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: "",
  salaryPeriod: "" as const,
  closingDate: "",
  jobStatus: "OPEN" as const,
  applicationUrl: "",
  sourceUrl: "",
  attested: false,
};
const empty: PostInput = {
  title: "",
  slug: "",
  contentType: "JOB",
  body: jobTemplate,
  excerpt: "",
  categoryId: 0,
  tagIds: [],
  featuredMediaId: null,
  ogMediaId: null,
  metaTitle: "",
  metaDescription: "",
  canonicalUrl: "",
  noindex: false,
  adsEnabled: false,
  status: "DRAFT",
  scheduledLocal: "",
  confirmShort: false,
  job: emptyJob,
};
export function PostEditor({ id, role }: { id: string; role: string }) {
  const router = useRouter();
  const [data, setData] = useState<PostInput>(empty);
  const [categories, setCategories] = useState<Term[]>([]);
  const [tags, setTags] = useState<Term[]>([]);
  const [media, setMedia] = useState<MediaRecord[]>([]);
  const [timezone, setTimezone] = useState("Asia/Karachi");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [inlineId, setInlineId] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ categories: Term[]; tags: Term[] }>("/api/admin/taxonomy"),
      api<MediaRecord[]>("/api/admin/media"),
      api<{ timezone: string }>("/api/admin/publishing-config"),
      id === "new"
        ? Promise.resolve(null)
        : api<RecordPost>(`/api/admin/posts/${id}`),
    ])
      .then(([terms, images, config, post]) => {
        if (!active) return;
        setCategories(terms.categories);
        setTags(terms.tags);
        setMedia(images);
        setTimezone(config.timezone);
        if (post) {
          const job = post.jobDetails;
          setData({
            ...empty,
            ...post,
            excerpt: post.excerpt ?? "",
            metaTitle: post.metaTitle ?? "",
            metaDescription: post.metaDescription ?? "",
            canonicalUrl: post.canonicalUrl ?? "",
            tagIds: post.tags.map((link) => link.tag.id),
            scheduledLocal: post.scheduledAt
              ? toSiteTime(post.scheduledAt, config.timezone)
              : "",
            job: job
              ? {
                  ...emptyJob,
                  ...job,
                  location: job.location ?? "",
                  country: job.country ?? "",
                  employmentType: job.employmentType ?? "",
                  workplaceType: (job.workplaceType ?? "On-site") as
                    "On-site" | "Remote" | "Hybrid",
                  salaryCurrency: job.salaryCurrency ?? "",
                  salaryPeriod: (job.salaryPeriod ??
                    "") as typeof emptyJob.salaryPeriod,
                  closingDate: job.closingDate
                    ? toSiteTime(job.closingDate, config.timezone)
                    : "",
                  attested: !!job.linkAttestedAt,
                }
              : emptyJob,
          });
        } else setData({ ...empty, categoryId: terms.categories[0]?.id ?? 0 });
        setLoading(false);
      })
      .catch((error) => {
        if (active) {
          setError(error.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id]);
  function update<K extends keyof PostInput>(key: K, value: PostInput[K]) {
    setData((current) => ({ ...current, [key]: value }));
    setNotice("");
  }
  async function save(status: PostInput["status"]) {
    setBusy(true);
    setError("");
    setWarnings([]);
    try {
      const result = await api<{ post: { id: number }; warnings: string[] }>(
        `/api/admin/posts${id === "new" ? "" : "/" + id}`,
        {
          method: id === "new" ? "POST" : "PATCH",
          body: JSON.stringify({ ...data, status }),
        },
      );
      setWarnings(result.warnings);
      update("status", status);
      setNotice(ui.saved);
      if (id === "new") {
        router.replace(`/admin/posts/${result.post.id}`);
        return;
      }
      router.refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <p>{ui.loading}</p>;
  const words = data.body
    .replace(/<[^>]*>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const mediaSelect = (
    value: number | null,
    changed: (id: number | null) => void,
    label: string,
  ) => (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(event) => changed(Number(event.target.value) || null)}
    >
      <option value="">{ui.noImage}</option>
      {media.map((image) => (
        <option key={image.id} value={image.id}>
          {image.altText}
        </option>
      ))}
    </select>
  );
  return (
    <div>
      <div className="editor-top">
        <p>{ui.publishingTip}</p>
        {id !== "new" && (
          <Link
            prefetch={false}
            className="button secondary"
            target="_blank"
            rel="noopener"
            href={`/admin/preview/${id}`}
          >
            {ui.preview} ↗
          </Link>
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="success">
          {notice}
        </p>
      )}
      {warnings.length > 0 && (
        <div className="warning" role="status">
          <strong>{ui.warning}</strong>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="editor-layout">
        <form
          className="post-editor"
          onSubmit={(event) => {
            event.preventDefault();
            save(
              ((event.nativeEvent as SubmitEvent).submitter?.getAttribute(
                "value",
              ) as PostInput["status"]) || "DRAFT",
            );
          }}
        >
          <section className="panel field-stack">
            <label>
              {ui.title}
              <input
                value={data.title}
                required
                onChange={(event) => {
                  const title = event.target.value;
                  update("title", title);
                  if (id === "new")
                    update(
                      "slug",
                      title
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, "")
                        .slice(0, 75),
                    );
                }}
              />
            </label>
            <div className="field-grid">
              <label>
                {ui.slug}
                <input
                  value={data.slug}
                  required
                  onChange={(event) => update("slug", event.target.value)}
                />
              </label>
              <label>
                {ui.contentType}
                <select
                  value={data.contentType}
                  onChange={(event) =>
                    update(
                      "contentType",
                      event.target.value as "JOB" | "ARTICLE",
                    )
                  }
                >
                  <option value="JOB">Job listing</option>
                  <option value="ARTICLE">Article</option>
                </select>
              </label>
            </div>
            <label>
              {ui.excerpt}
              <textarea
                value={data.excerpt}
                maxLength={500}
                rows={3}
                onChange={(event) => update("excerpt", event.target.value)}
              />
            </label>
            <h2>{ui.body}</h2>
            <RichEditor
              value={data.body}
              onChange={(value) => update("body", value)}
              onInsertImage={async () =>
                media.find((image) => image.id === inlineId) ?? null
              }
            />
            <small>
              {words} {ui.wordCount}
            </small>
          </section>
          {data.contentType === "JOB" && (
            <section className="panel field-stack">
              <h2>{ui.job}</h2>
              <div className="field-grid">
                {jobFields.map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type={
                        key.startsWith("salary") && key !== "salaryCurrency"
                          ? "number"
                          : "text"
                      }
                      step="any"
                      min={0}
                      value={data.job?.[key] ?? ""}
                      onChange={(event) =>
                        update("job", {
                          ...emptyJob,
                          ...data.job,
                          [key]:
                            key === "salaryMin" || key === "salaryMax"
                              ? event.target.value === ""
                                ? null
                                : Number(event.target.value)
                              : event.target.value,
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  {labels.workplaceType}
                  <select
                    value={data.job?.workplaceType}
                    onChange={(event) =>
                      update("job", {
                        ...emptyJob,
                        ...data.job,
                        workplaceType: event.target.value as
                          "On-site" | "Remote" | "Hybrid",
                      })
                    }
                  >
                    {["On-site", "Remote", "Hybrid"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {labels.salaryPeriod}
                  <select
                    value={data.job?.salaryPeriod}
                    onChange={(event) =>
                      update("job", {
                        ...emptyJob,
                        ...data.job,
                        salaryPeriod: event.target
                          .value as typeof emptyJob.salaryPeriod,
                      })
                    }
                  >
                    {["", "HOUR", "DAY", "WEEK", "MONTH", "YEAR"].map(
                      (value) => (
                        <option key={value}>{value}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  {labels.closingDate} · {timezone}
                  <input
                    type="datetime-local"
                    value={data.job?.closingDate}
                    onChange={(event) =>
                      update("job", {
                        ...emptyJob,
                        ...data.job,
                        closingDate: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  {labels.jobStatus}
                  <select
                    value={data.job?.jobStatus}
                    onChange={(event) =>
                      update("job", {
                        ...emptyJob,
                        ...data.job,
                        jobStatus: event.target.value as
                          "OPEN" | "EXPIRED" | "FILLED",
                      })
                    }
                  >
                    {["OPEN", "EXPIRED", "FILLED"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={data.job?.attested ?? false}
                  onChange={(event) =>
                    update("job", {
                      ...emptyJob,
                      ...data.job,
                      attested: event.target.checked,
                    })
                  }
                />
                {ui.sourceAttest}
              </label>
              <button
                type="button"
                className="button secondary"
                onClick={async () => {
                  try {
                    const result = await api<{ warnings: string[] }>(
                      "/api/admin/check-links",
                      {
                        method: "POST",
                        body: JSON.stringify({
                          urls: [data.job?.sourceUrl, data.job?.applicationUrl],
                        }),
                      },
                    );
                    setWarnings(
                      result.warnings.length ? result.warnings : [ui.linkOk],
                    );
                  } catch (error) {
                    setError((error as Error).message);
                  }
                }}
              >
                {ui.linkCheck}
              </button>
            </section>
          )}
          <section className="panel field-stack">
            <h2>{ui.seo}</h2>
            <label>
              {ui.metaTitle}
              <input
                value={data.metaTitle}
                onChange={(event) => update("metaTitle", event.target.value)}
              />
              <small>
                {data.metaTitle.length}/60 {ui.characters}
              </small>
            </label>
            <label>
              {ui.metaDescription}
              <textarea
                rows={3}
                value={data.metaDescription}
                onChange={(event) =>
                  update("metaDescription", event.target.value)
                }
              />
              <small>
                {data.metaDescription.length}/160 {ui.characters}
              </small>
            </label>
            <label>
              {ui.canonicalUrl}
              <input
                type="url"
                value={data.canonicalUrl}
                onChange={(event) => update("canonicalUrl", event.target.value)}
              />
            </label>
            <div className="search-preview">
              <small>
                {typeof window !== "undefined" ? window.location.origin : ""}/
                {data.slug}
              </small>
              <h3>{data.metaTitle || data.title || ui.title}</h3>
              <p>{data.metaDescription || data.excerpt}</p>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={data.noindex}
                onChange={(event) => update("noindex", event.target.checked)}
              />
              {ui.noindex}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={data.adsEnabled}
                onChange={(event) => update("adsEnabled", event.target.checked)}
              />
              {ui.adsEnabled}
            </label>
          </section>
          <section className="panel field-stack">
            <div className="field-grid">
              <label>
                {ui.category}
                <select
                  required
                  value={data.categoryId || ""}
                  onChange={(event) =>
                    update("categoryId", Number(event.target.value))
                  }
                >
                  <option value="">{ui.chooseCategory}</option>
                  {categories.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {ui.scheduleTime} · {timezone}
                <input
                  type="datetime-local"
                  value={data.scheduledLocal}
                  onChange={(event) =>
                    update("scheduledLocal", event.target.value)
                  }
                />
              </label>
            </div>
            <fieldset>
              <legend>{ui.tags}</legend>
              <div className="checkbox-grid">
                {tags.map((term) => (
                  <label className="check" key={term.id}>
                    <input
                      type="checkbox"
                      checked={data.tagIds.includes(term.id)}
                      onChange={(event) =>
                        update(
                          "tagIds",
                          event.target.checked
                            ? [...data.tagIds, term.id]
                            : data.tagIds.filter((id) => id !== term.id),
                        )
                      }
                    />
                    {term.name}
                  </label>
                ))}
              </div>
            </fieldset>
            {role === "ADMIN" && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={data.confirmShort}
                  onChange={(event) =>
                    update("confirmShort", event.target.checked)
                  }
                />
                {ui.shortConfirm}
              </label>
            )}
            <div className="actions">
              <button
                disabled={busy}
                name="status"
                value="DRAFT"
                className="button secondary"
              >
                {ui.draft}
              </button>
              <button
                disabled={busy}
                name="status"
                value="PUBLISHED"
                className="button"
              >
                {ui.publish}
              </button>
              <button
                disabled={busy}
                name="status"
                value="SCHEDULED"
                className="button secondary"
              >
                {ui.schedule}
              </button>
              <button
                disabled={busy}
                name="status"
                value="UNPUBLISHED"
                className="button secondary"
              >
                {ui.unpublish}
              </button>
              <button
                disabled={busy}
                name="status"
                value="ARCHIVED"
                className="button secondary"
              >
                {ui.archive}
              </button>
            </div>
            <small>
              {ui.status}: {statusLabels[data.status]}
            </small>
          </section>
        </form>
        <aside className="editor-aside">
          <section className="panel field-stack">
            <h2>{ui.featured}</h2>
            {mediaSelect(
              data.featuredMediaId,
              (id) => update("featuredMediaId", id),
              ui.featured,
            )}
            <h2>{ui.og}</h2>
            {mediaSelect(
              data.ogMediaId,
              (id) => update("ogMediaId", id),
              ui.og,
            )}
            <h2>{ui.inlineImage}</h2>
            {mediaSelect(
              inlineId || null,
              (id) => setInlineId(id ?? 0),
              ui.inlineImage,
            )}
            <MediaPicker
              media={media}
              onUploaded={(image) => {
                setMedia((current) => [image, ...current]);
                setInlineId(image.id);
                if (!data.featuredMediaId) update("featuredMediaId", image.id);
              }}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
