"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Term, Serialized } from "@/lib/client-api";
import type { FullPost } from "@/lib/publishing";
import { ui, statusLabels } from "@/lib/ui-text";
export function PostList({ initialStatus = "" }: { initialStatus?: string }) {
  const router = useRouter();
  const [posts, setPosts] = useState<Serialized<FullPost>[]>([]);
  const [categories, setCategories] = useState<Term[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  async function load(
    query = new URLSearchParams({ status: initialStatus }).toString(),
  ) {
    try {
      setPosts(await api(`/api/admin/posts?${query}`));
      setSelected([]);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    api<Serialized<FullPost>[]>(
      `/api/admin/posts?${new URLSearchParams({ status: initialStatus })}`,
    )
      .then(setPosts)
      .catch((error) => setError(error.message))
      .finally(() => setLoading(false));
    api<{ categories: Term[] }>("/api/admin/taxonomy")
      .then((data) => setCategories(data.categories))
      .catch((error) => setError(error.message));
  }, [initialStatus]);
  return (
    <>
      <div className="editor-top">
        <p>
          {posts.length} {ui.posts.toLowerCase()}
        </p>
        <Link prefetch={false} className="button" href="/admin/posts/new">
          + {ui.newPost}
        </Link>
      </div>
      <form
        className="filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          load(
            new URLSearchParams(
              Object.fromEntries(new FormData(event.currentTarget)) as Record<
                string,
                string
              >,
            ).toString(),
          );
        }}
      >
        <input
          name="q"
          placeholder={ui.titleSearch}
          aria-label={ui.titleSearch}
        />
        <select
          name="status"
          aria-label={ui.status}
          defaultValue={initialStatus}
        >
          <option value="">{ui.allStatus}</option>
          {Object.entries(statusLabels).map(([key, value]) => (
            <option key={key} value={key}>
              {value}
            </option>
          ))}
        </select>
        <select name="category" aria-label={ui.category}>
          <option value="">{ui.allCategories}</option>
          {categories.map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
            </option>
          ))}
        </select>
        <label>
          {ui.since}
          <input type="date" name="date" />
        </label>
        <button className="button secondary">{ui.applyFilters}</button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <form
        className="bulk-bar"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!selected.length) {
            setError(ui.noSelection);
            return;
          }
          if (!confirm(ui.bulkConfirm)) return;
          const form = new FormData(event.currentTarget);
          setBusy(true);
          try {
            await api("/api/admin/bulk", {
              method: "POST",
              body: JSON.stringify({
                ids: selected,
                action: form.get("action"),
                confirmShort: form.get("confirmShort") === "on",
                categoryId: Number(form.get("categoryId")) || undefined,
              }),
            });
            await load();
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <span>
          {selected.length} {ui.selected.toLowerCase()}
        </span>
        <select name="action" aria-label={ui.bulkAction}>
          <option value="publish">{ui.publish}</option>
          <option value="unpublish">{ui.unpublish}</option>
          <option value="category">{ui.bulkCategory}</option>
          <option value="delete">{ui.remove}</option>
        </select>
        <select name="categoryId" aria-label={ui.bulkCategory}>
          <option value="">{ui.chooseCategory}</option>
          {categories.map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
            </option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" name="confirmShort" />
          {ui.shortConfirm}
        </label>
        <button disabled={busy} className="button secondary">
          {ui.runBulk}
        </button>
      </form>
      {loading ? (
        <p>{ui.loading}</p>
      ) : !posts.length ? (
        <div className="empty-state">
          <h2>{ui.noPosts}</h2>
          <Link prefetch={false} href="/admin/posts/new" className="button">
            {ui.newPost}
          </Link>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all posts"
                    checked={selected.length === posts.length}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? posts.map((post) => post.id)
                          : [],
                      )
                    }
                  />
                </th>
                <th>{ui.title}</th>
                <th>{ui.status}</th>
                <th>{ui.category}</th>
                <th>{ui.updated}</th>
                <th>{ui.edit}</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${post.title}`}
                      checked={selected.includes(post.id)}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? [...selected, post.id]
                            : selected.filter((id) => id !== post.id),
                        )
                      }
                    />
                  </td>
                  <td>
                    <Link prefetch={false} href={`/admin/posts/${post.id}`}>
                      <strong>{post.title}</strong>
                    </Link>
                    <small className="block">/{post.slug}</small>
                  </td>
                  <td>
                    <span
                      className={`status status-${post.status.toLowerCase()}`}
                    >
                      {statusLabels[post.status]}
                    </span>
                  </td>
                  <td>{post.category.name}</td>
                  <td>
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeZone: "Asia/Karachi",
                    }).format(new Date(post.updatedAt))}
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link prefetch={false} href={`/admin/posts/${post.id}`}>
                        {ui.edit}
                      </Link>
                      <button
                        onClick={async () => {
                          try {
                            const copy = await api<{ id: number }>(
                              `/api/admin/posts/${post.id}`,
                              { method: "POST" },
                            );
                            router.push(`/admin/posts/${copy.id}`);
                          } catch (error) {
                            setError((error as Error).message);
                          }
                        }}
                      >
                        {ui.duplicate}
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(ui.deleteConfirm)) {
                            try {
                              await api(`/api/admin/posts/${post.id}`, {
                                method: "DELETE",
                              });
                              load();
                            } catch (error) {
                              setError((error as Error).message);
                            }
                          }
                        }}
                      >
                        {ui.remove}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
