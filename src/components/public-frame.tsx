import { firebaseConfigured } from "@/lib/firebase-auth";
/* eslint-disable @next/next/no-html-link-for-pages -- Public links use full server navigation to limit hydration work on low-end devices. */
import { imageUrl } from "@/lib/image-url";
import { headers } from "next/headers";
import { publicAdPlan } from "@/lib/advertising";
import { ConsentRuntime } from "./consent-runtime";
import { AdPlacement } from "./ad-placement";
import { connection } from "next/server";
import { OptimizedImage as Image } from "./optimized-image";
import BrandImage from "next/image";
import { siteSettings } from "@/lib/settings";
import { ui, templatePages } from "@/lib/ui-text";
export async function PublicFrame({ children }: { children: React.ReactNode }) {
  await connection();
  const [settings, plan] = await Promise.all([siteSettings(), publicAdPlan()]);
  const nonce = (await headers()).get("x-nonce") ?? "";
  const content = (
    <>
      <header className="site-header">
        <a className="site-brand" href="/">
          {settings.logo ? (
            <Image
              src={imageUrl(settings.logo)}
              alt={settings.site_name}
              width={40}
              height={40}
            />
          ) : (
            <BrandImage
              className="site-brand-logo"
              src="/workboard-logo-transparent.webp"
              alt={settings.site_name}
              width={560}
              height={108}
              unoptimized
            />
          )}
          {settings.logo && settings.site_name}
        </a>
        <nav aria-label="Main navigation">
          <a href="/search">{ui.search}</a>
          <a href="/about">{ui.about}</a>
          <a href="/contact">{ui.contact}</a>
          {firebaseConfigured() && <a href="/account">Sign in / Account</a>}
          <a className="nav-admin" href="/admin">
            Publishing desk ↗
          </a>
        </nav>
      </header>
      <AdPlacement name="header" />
      {children}
      <footer className="site-footer">
        <div>
          <strong>{settings.site_name}</strong>
          <p>{ui.footer}</p>
        </div>
        <nav aria-label="Footer navigation">
          {templatePages.map((page) => (
            <a key={page.slug} href={`/${page.slug}`}>
              {page.title}
            </a>
          ))}
        </nav>
        {settings.social_links && (
          <nav aria-label="Social links">
            {settings.social_links
              .split(/\s+/)
              .filter(Boolean)
              .map((link, index) => (
                <a href={link} key={link} rel="noopener noreferrer">
                  Social {index + 1} ↗
                </a>
              ))}
          </nav>
        )}
      </footer>
    </>
  );
  if (plan.administrator || !plan.cookiebot_id)
    return (
      <>
        {content}
        <details className="privacy-control">
          <summary>Privacy preferences</summary>
          <p>Optional tracking is disabled on this visit.</p>
        </details>
      </>
    );
  return (
    <ConsentRuntime
      cookiebotId={plan.cookiebot_id}
      measurementId={plan.ga4_id}
      publisherId={plan.publisher_id}
      liveAds={plan.contentEligible && plan.ads_mode === "live"}
      nonce={nonce}
      administrator={plan.administrator}
    >
      {content}
    </ConsentRuntime>
  );
}
