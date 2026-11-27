"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { messages as m } from "@/lib/messages";
import { PasswordField } from "@/components/password-field";
export function LoginForm({
  initialStep = "login",
  initialSecret = "",
}: {
  initialStep?: string;
  initialSecret?: string;
}) {
  const Heading = initialStep === "login" ? "h1" : "h2";
  const [step, setStep] = useState(initialStep);
  const [secret, setSecret] = useState(initialSecret);
  const [codes, setCodes] = useState<string[]>([]);
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const response = await fetch(
        `/api/auth/${step === "login" ? "login" : "verify"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? m.failed);
        return;
      }
      if (result.step === "done") {
        router.replace("/admin");
        router.refresh();
        return;
      }
      if (step === "login") {
        if (result.step === "enroll") {
          const enrollment = await fetch("/api/auth/enroll", {
            method: "POST",
          });
          const details = await enrollment.json();
          if (!enrollment.ok) {
            setError(details.error);
            return;
          }
          setSecret(details.secret);
        }
        setStep("verify");
      } else if (result.recoveryCodes?.length) {
        setCodes(result.recoveryCodes);
        setStep("done");
      } else router.replace("/admin");
    } catch {
      setError(m.tryAgain);
    } finally {
      setBusy(false);
    }
  }
  if (step === "done")
    return (
      <section>
        <Heading className="text-2xl font-bold">{m.recovery}</Heading>
        <ul className="my-6 font-mono">
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <Link prefetch={false} href="/admin" className="underline">
          {m.continue}
        </Link>
      </section>
    );
  return (
    <form onSubmit={submit} className="member-credentials-form">
      <Heading>
        {step === "login"
          ? "Sign in to Publishing Desk"
          : "Verify your sign-in"}
      </Heading>
      {step === "login" ? (
        <>
          <label>
            {m.email}
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              className="block w-full rounded border p-3"
            />
          </label>
          <PasswordField label={m.password} maxLength={72} />
        </>
      ) : (
        <>
          {secret && (
            <div>
              <p>{m.enroll}</p>
              <code className="break-all select-all">{secret}</code>
            </div>
          )}
          <label>
            {m.code}
            <input
              name="code"
              required
              autoComplete="one-time-code"
              className="block w-full rounded border p-3"
            />
          </label>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button disabled={busy} className="button">
        {busy ? "Please wait…" : step === "login" ? m.login : m.verify}
      </button>
      {step !== "login" && (
        <Link prefetch={false} href="/login" className="underline">
          {m.startAgain}
        </Link>
      )}
    </form>
  );
}
