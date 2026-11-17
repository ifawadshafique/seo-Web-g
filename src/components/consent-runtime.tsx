"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
type Consent = { statistics: boolean; marketing: boolean; tcfReady: boolean };
type CookiebotSdk = {
  consent: { statistics: boolean; marketing: boolean };
  renew: () => void;
};
type TcfData = {
  gdprApplies?: boolean;
  eventStatus?: string;
  tcString?: string;
  purpose?: { consents?: Record<string, boolean> };
  vendor?: { consents?: Record<string, boolean> };
};
declare global {
  interface Window {
    Cookiebot?: CookiebotSdk;
    __tcfapi?: (
      command: string,
      version: number,
      callback: (data: TcfData, success: boolean) => void,
    ) => void;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    adsbygoogle?: unknown[];
  }
}
const empty: Consent = { statistics: false, marketing: false, tcfReady: false };
const Context = createContext({ consent: empty, adScriptReady: false });
export const useAdConsent = () => useContext(Context);
function script(
  id: string,
  src: string,
  nonce: string,
  attributes: Record<string, string> = {},
  ready?: () => void,
) {
  let element = document.getElementById(id) as HTMLScriptElement | null;
  if (element) {
    if (element.dataset.loaded === "true") ready?.();
    return;
  }
  element = document.createElement("script");
  element.id = id;
  element.async = true;
  element.src = src;
  if (nonce) element.nonce = nonce;
  for (const [key, value] of Object.entries(attributes))
    element.setAttribute(key, value);
  element.onload = () => {
    element!.dataset.loaded = "true";
    ready?.();
  };
  document.head.appendChild(element);
}
export function ConsentRuntime({
  children,
  cookiebotId,
  measurementId,
  publisherId,
  liveAds,
  nonce,
  administrator,
}: {
  children: React.ReactNode;
  cookiebotId: string;
  measurementId: string;
  publisherId: string;
  liveAds: boolean;
  nonce: string;
  administrator: boolean;
}) {
  const [consent, setConsent] = useState(empty);
  const [adScriptReady, setAdScriptReady] = useState(false);
  const [notice, setNotice] = useState(false);
  const tcfReady = useRef(false);
  const registered = useRef(false);
  const analyticsLoaded = useRef(false);
  const previousConsent = useRef(empty);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (administrator || !cookiebotId) return;
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params -- Google's gtag queue uses the native arguments object.
      window.dataLayer!.push(arguments);
    };
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    function sync() {
      const state = window.Cookiebot?.consent;
      const next = {
        statistics: state?.statistics === true,
        marketing: state?.marketing === true,
        tcfReady: tcfReady.current,
      };
      const revoked =
        (previousConsent.current.statistics &&
          !next.statistics &&
          analyticsLoaded.current) ||
        (previousConsent.current.marketing &&
          !next.marketing &&
          document.getElementById("site-adsense"));
      previousConsent.current = next;
      setConsent(next);
      window.gtag?.("consent", "update", {
        analytics_storage: next.statistics ? "granted" : "denied",
        ad_storage: next.marketing ? "granted" : "denied",
        ad_user_data: next.marketing ? "granted" : "denied",
        ad_personalization: next.marketing ? "granted" : "denied",
      });
      if (revoked) {
        document.getElementById("site-ga4")?.remove();
        document.getElementById("site-adsense")?.remove();
        window.location.reload();
        return;
      }
      if (window.__tcfapi && !registered.current) {
        registered.current = true;
        window.__tcfapi("addEventListener", 2, (data, success) => {
          tcfReady.current =
            success &&
            (data.gdprApplies === false ||
              (!!data.tcString &&
                ["tcloaded", "useractioncomplete"].includes(
                  data.eventStatus ?? "",
                ) &&
                data.purpose?.consents?.["1"] === true &&
                data.vendor?.consents?.["755"] === true));
          const state = window.Cookiebot?.consent;
          setConsent({
            statistics: state?.statistics === true,
            marketing: state?.marketing === true,
            tcfReady: tcfReady.current,
          });
        });
      }
    }
    for (const event of [
      "CookiebotOnConsentReady",
      "CookiebotOnAccept",
      "CookiebotOnDecline",
    ])
      window.addEventListener(event, sync);
    script(
      "Cookiebot",
      "https://consent.cookiebot.com/uc.js",
      nonce,
      { "data-cbid": cookiebotId, "data-culture": "EN" },
      sync,
    );
    return () => {
      for (const event of [
        "CookiebotOnConsentReady",
        "CookiebotOnAccept",
        "CookiebotOnDecline",
      ])
        window.removeEventListener(event, sync);
    };
  }, [cookiebotId, nonce, administrator]);
  useEffect(() => {
    if (administrator || !consent.statistics || !measurementId) return;
    script(
      "site-ga4",
      `https://www.googletagmanager.com/gtag/js?id=${measurementId}`,
      nonce,
      {},
      () => {
        if (!window.Cookiebot?.consent.statistics) return;
        if (!analyticsLoaded.current) {
          window.gtag?.("js", new Date());
          window.gtag?.("config", measurementId, { send_page_view: false });
          analyticsLoaded.current = true;
        }
        window.gtag?.("event", "page_view", {
          page_path:
            pathname +
            (searchParams?.toString() ? "?" + searchParams.toString() : ""),
        });
        const term = searchParams?.get("q");
        if (term)
          window.gtag?.("event", "view_search_results", {
            search_term: term.slice(0, 200),
          });
      },
    );
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.(
        "a[data-apply-link]",
      ) as HTMLAnchorElement | null;
      if (anchor)
        window.gtag?.("event", "apply_click", {
          link_url: new URL(anchor.href).origin + new URL(anchor.href).pathname,
          page_path: pathname,
        });
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, [
    consent.statistics,
    measurementId,
    nonce,
    administrator,
    pathname,
    searchParams,
  ]);
  useEffect(() => {
    if (
      administrator ||
      !liveAds ||
      !publisherId ||
      !consent.marketing ||
      !consent.tcfReady
    )
      return;
    script(
      "site-adsense",
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-${publisherId}`,
      nonce,
      { crossorigin: "anonymous" },
      () => setAdScriptReady(true),
    );
  }, [
    liveAds,
    publisherId,
    nonce,
    administrator,
    consent.marketing,
    consent.tcfReady,
  ]);
  useEffect(() => {
    if (!consent.statistics && !consent.marketing) {
      for (const key of document.cookie
        .split(";")
        .map((value) => value.split("=")[0].trim()))
        if (/^(_ga|_gid|_gat|_gcl|__gads|__gpi)/.test(key))
          document.cookie = `${key}=; Max-Age=0; path=/; SameSite=Lax`;
    }
  }, [consent.statistics, consent.marketing]);
  return (
    <Context.Provider value={{ consent, adScriptReady }}>
      {children}
      <div className="privacy-control">
        <button
          type="button"
          onClick={() => {
            if (window.Cookiebot && !administrator) window.Cookiebot.renew();
            else setNotice((value) => !value);
          }}
        >
          Privacy preferences
        </button>
        {notice && (
          <p role="status">Optional tracking is disabled on this visit.</p>
        )}
      </div>
    </Context.Provider>
  );
}
