"use client";
import { useState } from "react";
import { LoginForm } from "../login/form";
export function MemberForm({
  logout = false,
  staff = false,
}: {
  logout?: boolean;
  staff?: boolean;
}) {
  const [challenge, setChallenge] = useState<{ secret: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (challenge)
    return <LoginForm initialStep="verify" initialSecret={challenge.secret} />;
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
            `/api/member-auth/${logout ? "logout" : staff ? "staff" : "login"}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            },
          );
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Sign-in failed");
          if (result.step === "enroll" || result.step === "verify") {
            let secret = "";
            if (result.step === "enroll") {
              const enrollment = await fetch("/api/auth/enroll", {
                method: "POST",
              });
              const details = await enrollment.json();
              if (!enrollment.ok)
                throw new Error(details.error ?? "Unable to start MFA");
              secret = details.secret;
            }
            setChallenge({ secret });
            return;
          }
          window.location.assign(logout ? "/account/sign-in" : "/account");
        } catch (error) {
          setError((error as Error).message);
          setBusy(false);
        }
      }}
    >
      {!logout && !staff && (
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
        {busy
          ? "Please wait…"
          : logout
            ? "Sign out"
            : staff
              ? "Open publishing dashboard"
              : "Sign in"}
      </button>
    </form>
  );
}
