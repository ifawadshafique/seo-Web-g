"use client";
import { useState } from "react";
import { ui } from "@/lib/ui-text";
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="share-buttons">
      <span>{ui.share}</span>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(title + " " + url)}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        WhatsApp
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        Facebook
      </a>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setError(true);
          }
        }}
      >
        {ui.copy}
      </button>
      <span role="status" aria-live="polite" data-copy-status>
        {copied ? ui.copied : ""}
      </span>
      <details data-copy-fallback open={error || undefined}>
        <summary>Copy URL manually</summary>
        <input
          readOnly
          aria-label={ui.copy}
          value={url}
          onFocus={(event) => event.target.select()}
        />
      </details>
    </div>
  );
}
