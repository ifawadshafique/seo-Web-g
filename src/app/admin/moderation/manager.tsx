"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client-api";
type Report = {
  id: number;
  postUrl: string | null;
  reporterNote: string;
  status: string;
  createdAt: string;
  resolution: string | null;
  post: { id: number; title: string; status: string };
};
export function ModerationManager() {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Report[]>("/api/admin/moderation")
      .then(setReports)
      .catch((error) => setError(error.message));
  }, []);
  return (
    <div className="field-stack">
      <p>
        Review new reports within 48 hours. Marking a report under review
        immediately unpublishes its listing. Resolving a report leaves
        publication to the editor.
      </p>
      <label>
        Filter by status
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="">All reports</option>
          {["PENDING", "UNDER_REVIEW", "RESOLVED", "REJECTED"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      {!reports.length && (
        <div className="empty-state">No listing reports.</div>
      )}
      {reports
        .filter((report) => !filter || report.status === filter)
        .map((report) => (
          <section className="panel field-stack" key={report.id}>
            <h2>{report.post.title}</h2>
            <small>
              {report.createdAt} · {report.status} · Listing:{" "}
              {report.post.status}
            </small>
            <p>{report.reporterNote}</p>
            {report.postUrl && <small>{report.postUrl}</small>}
            <Link prefetch={false} href={`/admin/posts/${report.post.id}`}>
              Open post editor ↗
            </Link>
            <form
              className="field-stack"
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const data = Object.fromEntries(
                    new FormData(event.currentTarget),
                  );
                  await api("/api/admin/moderation", {
                    method: "POST",
                    body: JSON.stringify({ ...data, id: report.id }),
                  });
                  setReports(await api("/api/admin/moderation"));
                } catch (error) {
                  setError((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Review status
                <select
                  name="status"
                  defaultValue={
                    report.status === "PENDING" ? "UNDER_REVIEW" : report.status
                  }
                >
                  <option value="UNDER_REVIEW">
                    Under review — unpublish listing
                  </option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </label>
              <label>
                Review notes
                <textarea
                  required
                  name="resolution"
                  minLength={10}
                  maxLength={2000}
                  defaultValue={report.resolution ?? ""}
                />
              </label>
              <button disabled={busy} className="button">
                Save moderation action
              </button>
            </form>
          </section>
        ))}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
