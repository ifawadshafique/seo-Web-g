"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { ui } from "@/lib/ui-text";
type Inbox = {
  checkedAt: string;
  messages: {
    id: number;
    name: string;
    email: string;
    message: string;
    createdAt: string;
  }[];
  mail: {
    id: number;
    subject: string;
    text: string;
    state: string;
    lastError: string | null;
  }[];
  worker: {
    key: string;
    startedAt: string;
    completedAt: string | null;
    error: string | null;
  }[];
  tasks: {
    id: number;
    postId: number;
    attempts: number;
    lastError: string | null;
  }[];
};
export function InboxManager() {
  const [data, setData] = useState<Inbox | null>(null);
  const [error, setError] = useState("");
  async function load() {
    setData(await api("/api/admin/inbox"));
  }
  useEffect(() => {
    api<Inbox>("/api/admin/inbox")
      .then(setData)
      .catch((error) => setError(error.message));
  }, []);
  if (!data) return <p>{error || ui.loading}</p>;
  const last = data.worker.find((worker) => worker.key === "publishing");
  const healthy =
    last?.completedAt &&
    Date.parse(data.checkedAt) - Date.parse(last.completedAt) < 6 * 60000;
  return (
    <div className="field-stack">
      <section className="panel">
        <h2>{ui.worker}</h2>
        <p className={healthy ? "success" : "warning"}>
          {healthy ? ui.schedulerHealthy : ui.schedulerStale}
        </p>
        {last && (
          <p>
            {last.completedAt} {last.error}
          </p>
        )}
        {data.tasks.map((task) => (
          <div key={task.id} className="term-row">
            <Link prefetch={false} href={`/admin/posts/${task.postId}`}>
              {ui.posts} #{task.postId} · {task.lastError}
            </Link>
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  await api("/api/admin/retry-task", {
                    method: "POST",
                    body: JSON.stringify({ id: task.id }),
                  });
                  await load();
                } catch (error) {
                  setError((error as Error).message);
                }
              }}
            >
              {ui.retry}
            </button>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>{ui.messages}</h2>
        {!data.messages.length && <p>{ui.inboxEmpty}</p>}
        {data.messages.map((message) => (
          <article key={message.id} className="inbox-message">
            <strong>{message.name}</strong>
            <Link prefetch={false} href={`mailto:${message.email}`}>
              {message.email}
            </Link>
            <time>{message.createdAt}</time>
            <p>{message.message}</p>
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>{ui.mail}</h2>
        <p>{ui.localMail}</p>
        {data.mail.map((mail) => (
          <details key={mail.id}>
            <summary>
              {mail.subject} · {mail.state}
            </summary>
            <pre className="mail-text">{mail.text}</pre>
            {mail.lastError && <p>{mail.lastError}</p>}
          </details>
        ))}
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
