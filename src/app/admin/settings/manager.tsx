"use client";
import { useEffect, useState } from "react";
import { api, MediaRecord } from "@/lib/client-api";
import { ui } from "@/lib/ui-text";
export function SettingsManager() {
  const [data, setData] = useState<Record<string, string> | null>(null);
  const [media, setMedia] = useState<MediaRecord[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    Promise.all([
      api<Record<string, string>>("/api/admin/settings"),
      api<MediaRecord[]>("/api/admin/media"),
    ])
      .then(([settings, images]) => {
        setData(settings);
        setMedia(images);
      })
      .catch((error) => setError(error.message));
  }, []);
  if (!data) return <p>{error || ui.loading}</p>;
  return (
    <form
      className="panel field-stack settings-form"
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await api("/api/admin/settings", {
            method: "POST",
            body: JSON.stringify(data),
          });
          setNotice(ui.saved);
          setError("");
        } catch (error) {
          setError((error as Error).message);
        }
      }}
    >
      {[
        ["site_name", ui.siteName],
        ["tag_index_threshold", "Published posts before a tag can be indexed"],
        ["site_timezone", ui.timezone],
        ["default_meta_description", ui.siteDescription],
        ["social_links", ui.socialLinks],
      ].map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            value={data[key] ?? ""}
            onChange={(event) =>
              setData({ ...data, [key]: event.target.value })
            }
          />
        </label>
      ))}
      <label>
        {ui.siteLogo}
        <select
          value={data.logo ?? ""}
          onChange={(event) => setData({ ...data, logo: event.target.value })}
        >
          <option value="">{ui.noImage}</option>
          {media.map((image) => (
            <option key={image.id} value={image.url}>
              {image.altText}
            </option>
          ))}
        </select>
      </label>
      <label>
        {ui.expiredPolicy}
        <select
          value={data.expired_job_policy ?? "retain"}
          onChange={(event) =>
            setData({ ...data, expired_job_policy: event.target.value })
          }
        >
          <option value="retain">{ui.retention}</option>
          <option value="archive">{ui.archivedPolicy}</option>
          <option value="remove">{ui.removePolicy}</option>
        </select>
      </label>
      <button className="button">{ui.save}</button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="success">
          {notice}
        </p>
      )}
    </form>
  );
}
