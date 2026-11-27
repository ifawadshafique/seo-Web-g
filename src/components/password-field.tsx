"use client";

import { useId, useState } from "react";

export function PasswordField({
  label = "Password",
  maxLength,
  registering = false,
}: {
  label?: string;
  maxLength: number;
  registering?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const hintId = id + "-hint";
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <div className="member-password-field">
        <input
          className="block w-full rounded border p-3"
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          required
          minLength={registering ? 6 : undefined}
          maxLength={maxLength}
          autoComplete={registering ? "new-password" : "current-password"}
          aria-describedby={registering ? hintId : undefined}
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible(!visible)}
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
            <circle cx="12" cy="12" r="2.5" />
            {visible && <path d="m4 4 16 16" />}
          </svg>
        </button>
      </div>
      {registering && (
        <p className="member-password-hint" id={hintId}>
          Use at least 6 characters.
        </p>
      )}
    </div>
  );
}
