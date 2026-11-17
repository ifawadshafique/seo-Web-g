"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { ui, templatePages } from "@/lib/ui-text";
import { RichEditor } from "@/components/rich-editor";
type PageData = {
  slug: string;
  title: string;
  body: string;
  status: string;
  metaTitle: string;
  metaDesc: string;
};
export function PagesManager() {
  const [pages, setPages] = useState<PageData[]>([]);
  const [data, setData] = useState<PageData>({
    slug: "about",
    title: "About",
    body: "",
    status: "DRAFT",
    metaTitle: "",
    metaDesc: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    api<PageData[]>("/api/admin/pages")
      .then(setPages)
      .catch((error) => setError(error.message));
  }, []);
  return (
    <form
      className="panel field-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          const page = await api<PageData>("/api/admin/pages", {
            method: "POST",
            body: JSON.stringify(data),
          });
          setPages((current) => [
            ...current.filter((item) => item.slug !== page.slug),
            page,
          ]);
          setNotice(ui.saved);
          setError("");
        } catch (error) {
          setError((error as Error).message);
        }
      }}
    >
      <div className="field-grid">
        <label>
          {ui.pages}
          <select
            value={data.slug}
            onChange={(event) => {
              const template = templatePages.find(
                (page) => page.slug === event.target.value,
              )!;
              const page = pages.find((page) => page.slug === template.slug);
              setData(
                page
                  ? {
                      ...page,
                      metaTitle: page.metaTitle ?? "",
                      metaDesc: page.metaDesc ?? "",
                    }
                  : {
                      ...template,
                      body: "",
                      status: "DRAFT",
                      metaTitle: "",
                      metaDesc: "",
                    },
              );
              setNotice("");
            }}
          >
            {templatePages.map((page) => (
              <option value={page.slug} key={page.slug}>
                {page.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          {ui.title}
          <input
            required
            value={data.title}
            onChange={(event) =>
              setData({ ...data, title: event.target.value })
            }
          />
        </label>
      </div>
      <RichEditor
        key={data.slug}
        value={data.body}
        onChange={(body) => setData((current) => ({ ...current, body }))}
      />
      <label>
        {ui.metaTitle}
        <input
          value={data.metaTitle}
          onChange={(event) =>
            setData({ ...data, metaTitle: event.target.value })
          }
        />
      </label>
      <label>
        {ui.metaDescription}
        <textarea
          value={data.metaDesc}
          onChange={(event) =>
            setData({ ...data, metaDesc: event.target.value })
          }
        />
      </label>
      <label>
        {ui.status}
        <select
          value={data.status}
          onChange={(event) => setData({ ...data, status: event.target.value })}
        >
          <option>DRAFT</option>
          <option>PUBLISHED</option>
          <option>ARCHIVED</option>
        </select>
      </label>
      <button className="button">{ui.save}</button>
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
    </form>
  );
}
