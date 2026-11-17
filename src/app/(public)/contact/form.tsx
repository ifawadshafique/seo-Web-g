"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { ui } from "@/lib/ui-text";
export function ContactForm() {
  const [startedAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="panel field-stack contact-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        const form = event.currentTarget;
        try {
          await api("/api/contact", {
            method: "POST",
            body: JSON.stringify({
              ...Object.fromEntries(new FormData(form)),
              startedAt,
            }),
          });
          setNotice(ui.contactSaved);
          form.reset();
        } catch (error) {
          setError((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        {ui.contactName}
        <input name="name" required maxLength={100} autoComplete="name" />
      </label>
      <label>
        {ui.contactEmail}
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
        />
      </label>
      <label className="honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label>
        {ui.contactMessage}
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={7}
        />
      </label>
      <button disabled={busy} className="button">
        {ui.send}
      </button>
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
