"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
type Health = {
  csp: {
    hash: string;
    environment: string;
    daysObserved: number;
    unreviewedViolations: number;
    record: {
      startedAt: string;
      lastSeenAt: string;
      reviewedAt: string | null;
    } | null;
  };
  violations: {
    key: string;
    directive: string;
    blockedOrigin: string;
    path: string;
    hits: number;
    reviewedAt: string | null;
  }[];
  traffic: {
    key: string;
    kind: string;
    path: string;
    target: string | null;
    hits: number;
    status: number;
    lastSeenAt: string;
  }[];
  redirects: {
    id: number;
    fromPath: string;
    toPath: string;
    statusCode: number;
  }[];
};
export function SearchHealth() {
  const [data, setData] = useState<Health | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Health>("/api/admin/search-health")
      .then(setData)
      .catch((error) => setError(error.message));
  }, []);
  async function action(value: object) {
    try {
      await api("/api/admin/search-health", {
        method: "POST",
        body: JSON.stringify(value),
      });
      setData(await api("/api/admin/search-health"));
      setError("");
    } catch (error) {
      setError((error as Error).message);
    }
  }
  if (!data) return <p>{error || "Loading…"}</p>;
  return (
    <div className="field-stack">
      <section className="panel field-stack">
        <h2>Search outputs</h2>
        <div className="quick-links">
          <Link prefetch={false} href="/sitemap.xml">
            XML sitemap index
          </Link>
          <Link prefetch={false} href="/robots.txt">
            robots.txt
          </Link>
          <Link prefetch={false} href="/feed">
            RSS feed
          </Link>
          <Link prefetch={false} href="/ads.txt">
            ads.txt (when a publisher ID is configured)
          </Link>
        </div>
        <p>
          Search Console, Bing verification, and Google Rich Results checks
          require your public staging or production domain. Review the
          deployment checklist before launch.
        </p>
      </section>
      <section className="panel field-stack">
        <h2>CSP staging observation</h2>
        <p>
          Environment: {data.csp.environment} ·{" "}
          {data.csp.daysObserved.toFixed(2)} days observed ·{" "}
          {data.csp.unreviewedViolations} unreviewed violation groups
        </p>
        <p>
          Policy: <code className="break-all">{data.csp.hash}</code>
        </p>
        <p>
          A gap longer than ten minutes in the worker/request heartbeat resets
          the observation period. Enforcement needs seven uninterrupted staging
          days, reviewed reports, and owner sign-off.
        </p>
        <form
          className="field-stack"
          onSubmit={(event) => {
            event.preventDefault();
            action({
              action: "review-csp",
              note: new FormData(event.currentTarget).get("note"),
            });
          }}
        >
          <label>
            Owner review notes
            <textarea name="note" minLength={20} maxLength={1000} required />
          </label>
          <button className="button">Record completed staging review</button>
        </form>
        {data.csp.record?.reviewedAt && (
          <>
            <p className="success">Reviewed: {data.csp.record.reviewedAt}</p>
            <textarea
              aria-label="Staging CSP evidence"
              readOnly
              value={JSON.stringify(
                {
                  ...data.csp.record,
                  environment: data.csp.environment,
                  policyHash: data.csp.hash,
                  unreviewedViolations: data.csp.unreviewedViolations,
                },
                null,
                2,
              )}
              rows={8}
            />
          </>
        )}
      </section>
      <section className="panel">
        <h2>CSP reports</h2>
        {!data.violations.length && <p>No reports received.</p>}
        {data.violations.map((violation) => (
          <details key={violation.key}>
            <summary>
              {violation.directive} · {violation.blockedOrigin} ·{" "}
              {violation.hits} hits
            </summary>
            <p>{violation.path}</p>
            {violation.reviewedAt ? (
              <small>Dismissed with an audit record.</small>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  action({
                    action: "dismiss-violation",
                    key: violation.key,
                    note: new FormData(event.currentTarget).get("note"),
                  });
                }}
              >
                <label>
                  Explain why this report is unrelated (for example, a browser
                  extension). Fix real violations before review.
                  <textarea
                    required
                    name="note"
                    minLength={20}
                    maxLength={1000}
                  />
                </label>
                <button className="button secondary">
                  Dismiss unrelated report
                </button>
              </form>
            )}
          </details>
        ))}
      </section>
      <section className="panel">
        <h2>Redirect and 404 traffic</h2>
        <p>
          Counts retain paths only. Query strings, IP addresses, and referrers
          are not recorded.
        </p>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Path</th>
                <th>Destination</th>
                <th>Hits</th>
              </tr>
            </thead>
            <tbody>
              {data.traffic.map((event) => (
                <tr key={event.key}>
                  <td>{event.status}</td>
                  <td>{event.path}</td>
                  <td>{event.target ?? "—"}</td>
                  <td>{event.hits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Configured redirects</h2>
        {data.redirects.map((redirect) => (
          <p key={redirect.id}>
            {redirect.fromPath} → {redirect.toPath} ({redirect.statusCode})
          </p>
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
