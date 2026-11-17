"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import type { AdvertisingConfig } from "@/lib/ad-policy";
export function AdsManager() {
  const [data, setData] = useState<AdvertisingConfig | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<AdvertisingConfig>("/api/admin/ads")
      .then(setData)
      .catch((error) => setError(error.message));
  }, []);
  if (!data) return <p>{error || "Loading…"}</p>;
  return (
    <form
      className="field-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        setNotice("");
        try {
          await api("/api/admin/ads", {
            method: "POST",
            body: JSON.stringify(data),
          });
          setNotice("Advertising configuration saved.");
        } catch (error) {
          setError((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <section className="panel field-stack">
        <h2>Delivery & consent</h2>
        <p>
          Keep ads off until AdSense approves the site. Layout placeholders are
          available on protected staging only. Every slot keeps a stable
          reserved region when an ad is blocked or unavailable.
        </p>
        <div className="field-grid">
          <label>
            Ads mode
            <select
              value={data.ads_mode}
              onChange={(event) =>
                setData({
                  ...data,
                  ads_mode: event.target.value as AdvertisingConfig["ads_mode"],
                })
              }
            >
              <option value="off">Off</option>
              <option value="placeholder">Staging layout placeholders</option>
              <option value="live">Live — approval required</option>
            </select>
          </label>
          <label>
            AdSense publisher ID
            <input
              placeholder="pub-…"
              value={data.publisher_id}
              onChange={(event) =>
                setData({ ...data, publisher_id: event.target.value })
              }
            />
          </label>
          <label>
            Cookiebot domain group ID
            <input
              placeholder="Your Cookiebot UUID"
              value={data.cookiebot_id}
              onChange={(event) =>
                setData({ ...data, cookiebot_id: event.target.value })
              }
            />
          </label>
          <label>
            GA4 measurement ID
            <input
              placeholder="G-…"
              value={data.ga4_id}
              onChange={(event) =>
                setData({ ...data, ga4_id: event.target.value })
              }
            />
          </label>
        </div>
        <p>
          Cookiebot must be configured for your domain and the regions you
          serve. Enable its Google-certified IAB TCF integration before
          requesting live ads. No optional tracking loads before consent.
        </p>
      </section>
      <section className="panel field-stack">
        <h2>Placements</h2>
        <p>
          Mobile regions are limited to 320 × 100 to keep content dominant.
          Sidebar placement is desktop-only. Automatic overlay and interstitial
          ads remain off.
        </p>
        {data.slots.map((slot, index) => (
          <div className="field-grid panel" key={slot.key}>
            <label className="check">
              <input
                type="checkbox"
                checked={slot.enabled}
                onChange={(event) =>
                  setData({
                    ...data,
                    slots: data.slots.map((value, i) =>
                      i === index
                        ? { ...value, enabled: event.target.checked }
                        : value,
                    ),
                  })
                }
              />
              {slot.key}
            </label>
            <label>
              Approved slot ID
              <input
                inputMode="numeric"
                value={slot.slotId}
                onChange={(event) =>
                  setData({
                    ...data,
                    slots: data.slots.map((value, i) =>
                      i === index
                        ? { ...value, slotId: event.target.value }
                        : value,
                    ),
                  })
                }
              />
            </label>
            <label>
              Device
              <select
                value={slot.device}
                onChange={(event) =>
                  setData({
                    ...data,
                    slots: data.slots.map((value, i) =>
                      i === index
                        ? {
                            ...value,
                            device: event.target.value as typeof slot.device,
                          }
                        : value,
                    ),
                  })
                }
              >
                <option value="ALL">All devices</option>
                <option value="MOBILE">Mobile</option>
                <option value="DESKTOP">Desktop</option>
              </select>
            </label>
            <label>
              Desktop dimensions
              <select
                value={slot.sizes.desktop.join("x")}
                onChange={(event) =>
                  setData({
                    ...data,
                    slots: data.slots.map((value, i) =>
                      i === index
                        ? {
                            ...value,
                            sizes: {
                              ...value.sizes,
                              desktop: event.target.value
                                .split("x")
                                .map(Number) as [number, number],
                            },
                          }
                        : value,
                    ),
                  })
                }
              >
                {["300x250", "336x280", "728x90", "970x90", "300x600"].map(
                  (size) => (
                    <option key={size}>{size}</option>
                  ),
                )}
              </select>
            </label>
            <div
              className="ad-layout-sample"
              aria-label="Mobile layout preview"
            >
              <small>Mobile layout preview</small>
              <div>Advertisement · 320 × 100</div>
            </div>
          </div>
        ))}
      </section>
      <button disabled={busy} className="button">
        Save advertising settings
      </button>
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
