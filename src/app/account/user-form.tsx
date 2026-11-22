"use client";
import { useState } from "react";
export function MemberForm({ logout = false }: { logout?: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setBusy(true);
        try {
          const data = Object.fromEntries(new FormData(event.currentTarget));
          const response = await fetch(
            `/api/member-auth/${logout ? "logout" : "login"}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            },
          );
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Sign-in failed");
          window.location.assign(logout ? "/account/sign-in" : "/account");
        } catch (error) {
          setError((error as Error).message);
          setBusy(false);
        }
      }}
    >
      {!logout && (
        <>
          <label>
            Email
            <input
              className="block w-full rounded border p-3"
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              className="block w-full rounded border p-3"
              name="password"
              type="password"
              required
              maxLength={4096}
              autoComplete="current-password"
            />
          </label>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button className="button" disabled={busy}>
        {busy ? "Please wait…" : logout ? "Sign out" : "Sign in"}
      </button>
    </form>
  );
}
