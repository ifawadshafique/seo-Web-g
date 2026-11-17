"use client";
import { useEffect, useRef, useState } from "react";
import type { SlotConfig } from "@/lib/ad-policy";
import { useAdConsent } from "./consent-runtime";
import { adRegionStyle } from "./ad-markup";
export function AdRegion({
  slot,
  mode,
  publisherId,
}: {
  slot: SlotConfig;
  mode: "placeholder" | "live";
  publisherId: string;
}) {
  const region = useRef<HTMLDivElement>(null);
  const requested = useRef(false);
  const [near, setNear] = useState(false);
  const { consent, adScriptReady } = useAdConsent();
  useEffect(() => {
    const element = region.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (
      mode !== "live" ||
      !near ||
      !consent.marketing ||
      !consent.tcfReady ||
      !adScriptReady ||
      requested.current ||
      !region.current ||
      getComputedStyle(region.current).display === "none"
    )
      return;
    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
      requested.current = true;
    } catch {
      /* Retain the reserved region when blocked or unavailable. */
    }
  }, [mode, near, consent.marketing, consent.tcfReady, adScriptReady]);
  return (
    <div
      ref={region}
      style={adRegionStyle(slot)}
      className={`ad-region ad-device-${slot.device.toLowerCase()} ad-placement-${slot.key}`}
      data-ad-placement={slot.key}
      data-ad-mode={mode}
    >
      <small>
        Advertisement{mode === "placeholder" ? " — layout preview" : ""}
      </small>
      <div className="ad-reserved">
        {mode === "live" && consent.marketing && consent.tcfReady && (
          <ins
            className="adsbygoogle"
            style={{ display: "block", width: "100%", height: "100%" }}
            data-ad-client={`ca-${publisherId}`}
            data-ad-slot={slot.slotId}
            data-full-width-responsive="false"
          />
        )}
      </div>
    </div>
  );
}
