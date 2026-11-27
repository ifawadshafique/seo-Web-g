"use client";
import { useState } from "react";
import { LoginForm } from "../login/form";
import { PasswordField } from "@/components/password-field";
export function MemberForm({
  logout = false,
  staff = false,
  saveJob,
  register = false,
}: {
  logout?: boolean;
  staff?: boolean;
  saveJob?: string;
  register?: boolean;
}) {
  const [challenge, setChallenge] = useState<{ secret: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (challenge)
    return <LoginForm initialStep="verify" initialSecret={challenge.secret} />;
  return (
    <form
      className={
        logout || staff ? "flex flex-col gap-5" : "member-credentials-form"
      }
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setBusy(true);
        try {
          const data = Object.fromEntries(new FormData(event.currentTarget));
          const response = await fetch(
            `/api/member-auth/${logout ? "logout" : staff ? "staff" : register ? "register" : "login"}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            },
          );
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Sign-in failed");
          if (saveJob && !logout && !staff) {
            const saved = await fetch(
              "/api/saved-jobs/" + encodeURIComponent(saveJob),
              { method: "PUT" },
            );
            if (!saved.ok)
              throw new Error(
                "You’re signed in, but the job could not be saved. Return to the listing to try again.",
              );
            // Reload after changing the session so cached signed-out UI is discarded.
            window.location.assign(
              new URL("/" + saveJob, window.location.origin),
            );
            return;
          }
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
            Email address
            <input
              className="block w-full rounded border p-3"
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="username"
              placeholder="you@example.com"
            />
          </label>
          <PasswordField maxLength={4096} registering={register} />
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
              : register
                ? "Create account"
                : "Sign in"}
      </button>
    </form>
  );
}
