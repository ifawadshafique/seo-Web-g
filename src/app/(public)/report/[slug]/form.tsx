"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
export function ReportForm({ slug }: { slug: string }) {
  const [startedAt] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (done)
    return (
      <p role="status" className="success">
        Your report was saved for review. Thank you for helping keep listings
        accurate.
      </p>
    );
  return (
    <form
      className="panel field-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api("/api/reports", {
            method: "POST",
            body: JSON.stringify({
              ...Object.fromEntries(new FormData(event.currentTarget)),
              slug,
              startedAt,
            }),
          });
          setDone(true);
        } catch (error) {
          setError((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        What concerns you about this listing?
        <textarea
          name="note"
          required
          minLength={10}
          maxLength={2000}
          rows={6}
        />
      </label>
      <p>
        Describe the issue without including identity documents, payment
        details, or other private information.
      </p>
      <label className="honeypot" aria-hidden="true">
        Website
        <input name="website" autoComplete="off" tabIndex={-1} />
      </label>
      <button className="button" disabled={busy}>
        Submit report
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}
