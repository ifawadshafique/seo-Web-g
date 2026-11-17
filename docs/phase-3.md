# Phase 3: SEO, lifecycle and moderation

## Local implementation

Implemented: server-rendered metadata and canonical URLs, Open Graph/Twitter cards, 1200 × 630 social images, JobPosting/Article and breadcrumb structured data, Organization markup, split XML sitemaps, robots.txt, RSS, tag index thresholds, listing reports/moderation, typed advertising settings and staging-only reserved ad layouts, a Cookiebot adapter with consent/TCF gating, GA4 event wiring, privacy-safe redirect/404 reporting, and nonce-based CSP reporting.

This is implementation and local verification, not staging sign-off. Gate 2 still needs the owner’s actual protected staging deployment and its checks. A real Google-certified CMP account/domain configuration, Google Rich Results validation, public webmaster verification, and the seven-day CSP observation cannot be completed by local test fixtures.

## Search output

- `/sitemap.xml` links to separate post, category, tag and static-page sitemap chunks under `/sitemaps/`. Chunks have at most 45,000 URLs. They are generated per request, with update dates taken from content, hub descriptions, and relevant site settings. Draft, scheduled, unpublished, archived, deleted and per-post noindex records are excluded. Category pages are included; tags need the configured published-post threshold and a 150-word introduction.
- `/robots.txt` allows production public pages, including internal search, while discouraging administrative/API crawling. Protected endpoints still require authorization. Local and staging environments disallow indexing globally. `/search` and listing-report pages independently emit noindex.
- `/feed` is an XML RSS feed of the latest eligible posts.
- Public page metadata has one canonical URL, Open Graph and Twitter tags, and normalized title/description lengths. Pagination uses a distinct title and self-referencing `?page=N` canonical. Country/tag search filters use the noindex search route. Owners must still resolve duplicate SEO warnings in authored content before the release crawl.
- `/api/og?post=<slug>` crops an uploaded sharing/featured image to 1200 × 630. Missing images fall back to a generated branded card. Private posts cannot be read through this endpoint.
- Set `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION` for the webmaster verification tags, then verify your real hostname and submit the sitemap in the provider consoles. No console accounts were created or submissions performed locally.

Only valid, publicly published, indexable open jobs emit JobPosting. Country names/codes are resolved to ISO country codes. Fully remote jobs use TELECOMMUTE and the listed country as applicant-location eligibility; hybrid jobs retain their physical location. Employment/salary fields are included only when supported by the saved data. Unknown countries suppress JobPosting and produce an editorial warning. Closing dates are never synthesized or extended. Filled jobs and past deadlines immediately lose JobPosting markup, even before the expiry worker runs. Articles emit Article rather than JobPosting. JSON-LD is serialized with script-boundary escaping and a request nonce.

Public images use Next.js `getImageProps` and its responsive image optimizer, with server-rendered dimensions/alt text and no image-component hydration. Inline images load lazily; featured images alone are eagerly loaded and preloaded. The monospace font is not preloaded on public pages. Placeholder slots are static reserved markup, and missing-CMP/admin visits use a native privacy disclosure without mounting provider code. The public layout sends visible content directly instead of a whole-page streamed loading shell; browser checks verify visible headings with JavaScript disabled. Share links and the manual-copy fallback are server-rendered. Only the small clipboard control needs client interactivity; a resolved, localized Suspense boundary lets React schedule that work separately. Browser tests cover clipboard success and denial. The app keeps standard request-time rendering after the Phase 2 cache-mode navigation issue; it does not re-enable Cache Components. Per-request React memoization avoids repeated settings reads without sharing private responses. CDN deployment and real traffic performance remain deployment checks.

## Moderation

Every public job has a Report this listing link. The form validates notes, rejects its spam honeypot/timing failures, bounds request size and rate-limits submissions using hashed request buckets. Reports store the server-derived listing URL, note, timestamp and status, and queue an owner notification. No anonymous report automatically unpublishes a listing.

Administrators review reports at `/admin/moderation`. Marking UNDER_REVIEW atomically unpublishes the listing and cancels its scheduled task. Save, bulk-publish and scheduler paths reject publication while a report is under review. Resolve/reject actions require notes and are audited. Resolving a report does not silently republish content; the editor must correct and explicitly republish it. The worker queues daily alerts for reports waiting at least 48 hours. The existing local inbox remains the notification destination when running locally without SMTP.

Expiry continues to support retained/clearly closed pages, archive, or removal according to site settings. Job schema is suppressed directly from the deadline as well as persisted status. Public cards/API status also account for an elapsed deadline, rather than waiting for the worker’s next tick.

## Advertising and consent

Manage the six allowlisted placements at `/admin/ads`: header, after the first paragraph, a middle placement for bodies over 800 words, end of post, desktop sidebar, and every sixth listing card. Table/list/paragraph boundaries are preserved during insertion. IDs, placement keys, dimensions and device values are typed; scripts or unknown configuration fields are rejected. Automatic overlay/interstitial ads are not enabled.

Modes:

- **off:** no ad regions, ins elements or vendor ad scripts render. This remains the local/production default.
- **placeholder:** protected **staging only**. Real reserved regions are labeled as layout previews. Local admin settings show a separate illustrative sizing sample without turning public placeholders on.
- **live:** requires `ADSENSE_APPROVED=true`, a valid publisher ID, a Cookiebot domain group ID, `COOKIEBOT_TCF_ENABLED=true`, and approved IDs for enabled slots. `/ads.txt` serves the configured publisher’s DIRECT record. Real approval is external and must be checked by the owner; setting a test environment flag is not evidence of approval.

Mobile regions are 320 × 100; desktop sizes are allowlisted by placement. Regions remain reserved before consent, during lazy loading and when ads are blocked/failed, avoiding a late collapse. Content-poor pages, search, contact, report/404/login/admin pages, and posts with ads disabled are excluded. Listings need enough cards and an introduction; posts/static pages need at least 400 words for ads. Any administrator session handle conservatively suppresses both ads and optional tracking, even if it is expired.

The requested Cookiebot integration is prepared but no account was created. Register/configure your real domain in Cookiebot, enable its Google-certified IAB TCF integration with the required Google vendor configuration, and place the domain group UUID in the admin screen or `COOKIEBOT_DOMAIN_GROUP_ID`. Configure the banner for the EEA, UK, Switzerland and any other jurisdictions you serve. This adapter requests consent globally rather than guessing visitors’ geography.

No GA4/AdSense script loads before the required consent. GA4 requires statistics consent; ads also require marketing consent plus an eligible TCF signal/Google vendor consent when GDPR applies. Missing, blocked or unavailable CMP state stays denied. Consent withdrawal updates the state and reloads after removing optional scripts so a fresh denied visit does not load them. Privacy preferences can be reopened from the footer. Admin sessions do not initialize the provider. GA4 tracks page views, public search terms and outbound apply clicks (the apply event strips query/fragment values); configure `GA4_MEASUREMENT_ID` or the admin field. Review GA4 enhanced-measurement/history settings to avoid duplicate automatic page views alongside the application’s manual page-view events.

Local browser tests replace provider scripts with controlled fixtures and verify requests before/after consent. They do not contact Google to request real ads and do not certify the actual Cookiebot dashboard configuration. Recheck consent and CSP against the real provider on staging before launch; recheck real ad behavior after approval (Gate 4).

## CSP and search-health reporting

`/admin/search-health` shows sitemap/feed links, redirect/404 counts, CSP reports and the current observation record. Traffic stores paths/counts only; query strings, IPs and referrers are excluded. CSP reports are bounded/rate-limited, aggregate blocked origins rather than full blocked URLs, and omit source samples. Traffic/violation aggregates are pruned after 90 days.

The default is `CSP_MODE=report-only`. Proxy generates an unpredictable request nonce and forwards the CSP to Next.js so framework scripts and application JSON-LD receive the same nonce. The allowlist covers self-hosted resources, Cookiebot, GA4 and the approved Google ad origins. Script attributes/objects are blocked; inline styles are allowed for framework/editor/ad dimensions. Development alone allows eval and local WebSockets. Report-only does not block violations; it records them for review.

The worker and HTML requests maintain the observation heartbeat. A gap over ten minutes resets the record and review state. The policy hash normalizes the per-request nonce; changing the policy creates a new observation record. After seven uninterrupted **staging** days and no unreviewed violation groups, an administrator can record review notes. Genuine violations require a code/policy fix; unrelated reports (for example extension traffic) can be explicitly dismissed with an audit record. A later report in the same group reopens it.

Enforcement is gated, not automatically enabled by this work. `CSP_MODE=enforce` on staging requires the current clean reviewed record. Production uses a separate database, so copy the owner-reviewed staging record exported by the panel into `CSP_STAGING_EVIDENCE`; it must identify staging, match the policy hash, span at least seven days and show no unreviewed violations. This is a deployment-owner attestation, not a cryptographically signed certificate. Without valid evidence, the application stays report-only. Do not fabricate timestamps/evidence to bypass the release gate. Local QA only tests the guards; it has not elapsed seven real staging days.

## Protected staging images

Next.js does not forward HTTP Basic credentials when its optimizer reads an image source. On Basic-protected staging, server-rendered image URLs therefore include a short-lived HMAC signature scoped to a single image path. Proxy accepts that image request only when the signature/expiry is valid. Page/admin/API authentication remains unchanged, and unsigned staging media still requires Basic authentication. `images.localPatterns` is restricted to `/api/media/**`. Production public image URLs remain unchanged. Keep `AUTH_ENCRYPTION_KEY` private and use separate secrets/buckets per environment.

## Database and local setup

Migrations `202611170001_search_moderation` and `202611170002_setting_dates_ad_keys` add report moderation fields/statuses, traffic/CSP aggregates, CSP observation records, hub/settings timestamps and a unique ad-slot key. Existing post/page slug triggers, salary constraints and search indexes are preserved. Private pre-migration backups are under `.local/backups/pre-phase3-*.dump`.

Run `npm run db:migrate`, then the app and `npm run worker`. The worker is required for expiry, scheduled publishing, overdue-report alerts and continuous CSP observation. Local ads stay off; use the admin size samples for local review or deploy protected staging for true placeholder testing. The existing local MFA bypass remains development-only.

During this work, a real build-time security advisory was detected. Compatible patches were applied: Next.js and eslint-config-next 16.4.6, Prisma/client 7.10.1. The reported Next.js caching advisory is fixed by this patched line. Dependency audit still reported moderate transitive/tooling advisories; those remain maintenance work for the hardening phase, and no claim of a vulnerability-free dependency tree is made.

## Validation and outstanding gates

Commands:

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:phase3
CHECK_PERFORMANCE=true npm run test:phase3
```

`test:phase3` provisions only the specifically named disposable local `seo_phase3_test` database, migrates it, starts protected staging/production-mode test servers on ports 3103/3104, and uses a local S3-compatible image fixture on 3115. Fixtures never use the owner’s content database. Provider scripts are mocked only inside browser QA. Reports/screenshots are saved privately under `.local/`; Lighthouse JSON is under `.local/lighthouse/`. Real provider validation is still required. The local test servers are stopped on completion.

Latest local verification: 38 unit tests, type checking, lint, the production build, Phase 2 integration/browser regression checks, and Phase 3 integration/browser checks passed. CI now includes the Phase 3 checks. Public navigation uses ordinary server links to reduce hydration work. The default Next.js Turbopack production build also passes the publishing/editor regression suite; CI now builds with the same default bundler rather than webpack.

Local mobile performance now passes every original threshold on the representative runs of the final default production build. All twelve samples are retained, including individual samples over the blocking-time target; the gate uses Lighthouse’s documented representative-run selection, not the best score. Accessibility scored 100 in all four representative reports.

| Mode | Page | Performance | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- |
| off | List | 99 | 0.82 s | 0 | 149 ms |
| off | Post | 99 | 1.76 s | 0 | 100 ms |
| placeholder | List | 97 | 0.82 s | 0 | 184 ms |
| placeholder | Post | 98 | 2.32 s | 0 | 100 ms |

These are local lab measurements with provider scripts absent, not actual staging or field sign-off. Actual Cookiebot behavior and real staging performance must still be checked after deployment.

Gate 2 remains pending until the same acceptance checks pass on the owner’s actual staging deployment. In particular, Google Rich Results/Search Console validation, real CMP regional behavior, staging Lighthouse runs, and the later CSP seven-day observation/review are not established by local test data. Gate 3 still requires the legal/content/operations and other hardening work defined by the SRS. Real live ads/field Web Vitals remain Gate 4 work after approval and traffic.

## Repeatable mobile measurements

The performance runner uses Lighthouse's default mobile throttling and **three sequential samples per page/mode**, with a fresh Chrome process for each scenario. It retains every sample and uses Lighthouse's own `computeMedianRun` (distance to median FCP/TTI), rather than picking the highest score or assembling favorable metrics from different runs. Every original threshold applies to that representative report: performance at least 90, LCP at most 2.5 seconds, CLS at most 0.1, TBT at most 200 ms. This follows [Lighthouse's variability guidance](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md). Do not run builds or other browser suites concurrently with the audits.

CI is configured to run these checks and save the reports, including failed runs. The remote GitHub workflow has not been executed from this local session. Authorization credentials are redacted before reports are written. Files `off-list-1.json` through `placeholder-post-3.json` contain all twelve samples, `off-list.json` etc. contain the selected reports, and `summary.json` identifies the selected sample for each scenario. These are local laboratory results with no real provider scripts; staging and field measurements remain separate.

## Completing the deployment checks

A protected free staging prototype is deployed at https://seo-web-g-staging.vercel.app; see [the current hosting status](staging.md). Local test servers remain disposable fixtures. The hosted prototype has no continuous scheduler or real elapsed seven-day observation, and original schema-validation content is still required.

1. Deploy a separate staging environment using the platform/setup guide. Use its own database, image bucket and secrets; set `APP_ENV=staging`, an HTTPS `SITE_URL`, `STAGING_BASIC_AUTH`, `CSP_MODE=report-only`, and ads `off` or `placeholder`. Keep `LOCAL_AUTH_SKIP_MFA=false`. Configure the real worker/cron every five minutes so the CSP heartbeat does not reset.
2. Configure the staging hostname and certified TCF setup in your Cookiebot account. Enter its actual domain group ID in Ads settings. Check denied, granted and withdrawn consent, regional banner behavior, browser CSP reports, and the Google vendor signal on the real provider. Test fixtures do not certify a real account.
3. Publish at least five valid open jobs and five original articles for schema comparison. With `STAGING_BASIC_AUTH` set privately, run `npm run check:staging -- https://your-staging-host.example`. This read-only command checks protection, robots, sitemap/RSS, metadata uniqueness, canonicals, image attributes, nonce coverage and sample schema counts. It never changes content, ads, or CSP dates. It saves `.local/staging-check.json`; failures remain failures. Use a full crawler for more than 200 URLs.
4. Run mobile Lighthouse against both list and post URLs in each real staging ads mode, and retain all reports. The deployment check command does not claim to run Lighthouse, Google Rich Results or provider regional tests. Run those separately and compare the structured data with the visible page. Search Console/Bing verification and sitemap submission require your actual hostname/provider accounts.
5. Let the worker observe the real staging policy for seven uninterrupted days. Review real violations in Search Health, fix genuine problems, and record the owner review only when the guard permits it. A gap over ten minutes or policy change restarts the applicable observation. Production CSP enforcement remains a later gate.
