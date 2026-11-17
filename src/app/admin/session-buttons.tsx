"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { messages as m } from "@/lib/messages";
export function SessionButtons() {
  const router = useRouter();
  const [error, setError] = useState("");
  async function end(action: string) {
    try {
      const response = await fetch(`/api/auth/${action}`, { method: "POST" });
      if (!response.ok) {
        setError(m.signInAgain);
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError(m.signOutFailed);
    }
  }
  return (
    <div className="my-4 flex gap-4">
      <button onClick={() => end("logout")} className="rounded border p-3">
        {m.logout}
      </button>
      <button onClick={() => end("revoke")} className="rounded border p-3">
        {m.revoke}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
