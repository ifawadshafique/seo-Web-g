"use client";
import { useState } from "react";
import { api, MediaRecord } from "@/lib/client-api";
import { ui } from "@/lib/ui-text";
export function MediaPicker({
  media,
  onUploaded,
}: {
  media: MediaRecord[];
  onUploaded: (image: MediaRecord) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="upload-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setBusy(true);
        const form = event.currentTarget;
        try {
          const image = await api<MediaRecord>("/api/admin/media", {
            method: "POST",
            body: new FormData(form),
          });
          onUploaded(image);
          form.reset();
        } catch (error) {
          setError((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        {ui.chooseFile}
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          required
        />
      </label>
      <label>
        {ui.alt}
        <input name="alt" required maxLength={500} />
      </label>
      <small>{ui.mediaHelp}</small>
      <button className="button secondary" disabled={busy}>
        {busy ? ui.saving : ui.addImage}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <small>{media.length} images in your library</small>
    </form>
  );
}
