"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savedJobSignInPath } from "@/lib/saved-job-path";

export function SaveJobButton({
  slug,
  initialSaved = false,
  removeOnly = false,
}: {
  slug: string;
  initialSaved?: boolean;
  removeOnly?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="save-job-control">
      <button
        type="button"
        className="button secondary save-job-button"
        aria-pressed={removeOnly ? undefined : saved}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const response = await fetch(
              "/api/saved-jobs/" + encodeURIComponent(slug),
              {
                method: saved || removeOnly ? "DELETE" : "PUT",
              },
            );
            if (response.status === 401) {
              window.location.assign(
                removeOnly ? "/account/sign-in" : savedJobSignInPath(slug),
              );
              return;
            }
            if (!response.ok)
              throw new Error("Could not update saved jobs. Try again.");
            setSaved(!saved && !removeOnly);
            if (removeOnly) router.refresh();
          } catch (failure) {
            setError((failure as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 3h12v18l-6-4-6 4z" strokeLinejoin="round" />
        </svg>
        {removeOnly ? "Remove" : saved ? "Saved" : "Save job"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
