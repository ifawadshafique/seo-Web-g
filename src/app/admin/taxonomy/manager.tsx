"use client";
import { useEffect, useState } from "react";
import { api, Term } from "@/lib/client-api";
import { ui } from "@/lib/ui-text";
export function TaxonomyManager() {
  const [data, setData] = useState<{ categories: Term[]; tags: Term[] }>({
    categories: [],
    tags: [],
  });
  const [kind, setKind] = useState("category");
  const [term, setTerm] = useState({
    id: 0,
    name: "",
    slug: "",
    description: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    setData(await api("/api/admin/taxonomy"));
  }
  useEffect(() => {
    api<{ categories: Term[]; tags: Term[] }>("/api/admin/taxonomy")
      .then(setData)
      .catch((error) => setError(error.message));
  }, []);
  const terms = kind === "category" ? data.categories : data.tags;
  return (
    <div className="settings-layout">
      <section className="panel">
        <div className="editor-top">
          <h2>{ui.taxonomy}</h2>
          <select
            aria-label={ui.termKind}
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
              setTerm({ id: 0, name: "", slug: "", description: "" });
            }}
          >
            <option value="category">{ui.category}</option>
            <option value="tag">{ui.tags}</option>
          </select>
        </div>
        {terms.map((item) => (
          <div className="term-row" key={item.id}>
            <button
              onClick={() =>
                setTerm({ ...item, description: item.description ?? "" })
              }
            >
              <strong>{item.name}</strong>
              <small>/{item.slug}</small>
            </button>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (!confirm(ui.mergeWarning)) return;
                try {
                  await api("/api/admin/taxonomy", {
                    method: "POST",
                    body: JSON.stringify({
                      operation: "merge",
                      kind,
                      id: item.id,
                      targetId: Number(
                        new FormData(event.currentTarget).get("targetId"),
                      ),
                    }),
                  });
                  await load();
                  setNotice(ui.saved);
                } catch (error) {
                  setError((error as Error).message);
                }
              }}
            >
              <select required name="targetId" aria-label={ui.target}>
                <option value="">{ui.merge}</option>
                {terms
                  .filter((other) => other.id !== item.id)
                  .map((other) => (
                    <option key={other.id} value={other.id}>
                      {other.name}
                    </option>
                  ))}
              </select>
              <button className="button secondary">{ui.merge}</button>
            </form>
          </div>
        ))}
      </section>
      <form
        className="panel field-stack"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          try {
            await api("/api/admin/taxonomy", {
              method: "POST",
              body: JSON.stringify({ ...term, id: term.id || undefined, kind }),
            });
            await load();
            setNotice(ui.saved);
            setTerm({ id: 0, name: "", slug: "", description: "" });
          } catch (error) {
            setError((error as Error).message);
          }
        }}
      >
        <h2>{term.id ? ui.edit : ui.createTerm}</h2>
        <label>
          {ui.termName}
          <input
            required
            value={term.name}
            onChange={(event) =>
              setTerm({
                ...term,
                name: event.target.value,
                slug: term.id
                  ? term.slug
                  : event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, ""),
              })
            }
          />
        </label>
        <label>
          {ui.slug}
          <input
            required
            value={term.slug}
            onChange={(event) => setTerm({ ...term, slug: event.target.value })}
          />
        </label>
        <label>
          {ui.termDescription}
          <textarea
            rows={8}
            value={term.description}
            onChange={(event) =>
              setTerm({ ...term, description: event.target.value })
            }
          />
        </label>
        <button className="button">{ui.save}</button>
        <button
          className="button secondary"
          type="button"
          onClick={() =>
            setTerm({ id: 0, name: "", slug: "", description: "" })
          }
        >
          {ui.newTerm}
        </button>
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
    </div>
  );
}
