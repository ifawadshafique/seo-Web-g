# Phase 2: Publishing

## Implemented experience

The local site now has a publishing workspace at `/admin/posts`, a Tiptap editor (headings, lists, tables, links and uploaded inline images), featured/social image selection, job details, source attestation, SEO fields and a search-snippet preview. Posts can be saved as drafts, scheduled, published, unpublished, archived, duplicated, or moved to trash. The list supports title/status/category/date filters and bulk publication, unpublishing, category changes and trash operations. Short publications require the admin’s explicit confirmation; editors cannot supply that approval.

`/admin/taxonomy` creates, edits and merges categories and tags. `/admin/settings` edits the site name, timezone, default description, uploaded logo, social links and expired-job policy. `/admin/pages` edits About, Contact, Privacy Policy, Terms and Disclaimer. These pages start as drafts and need the owner’s content before publication; no legal review is implied by creating their records. `/admin/inbox` shows contact messages, queued/local email, publication failures, and the latest worker status.

The public site provides post cards, combined country/tag/keyword filters, PostgreSQL full-text search, 12-item category/tag pagination, full server-rendered detail pages, breadcrumbs, related posts, sharing links, and a contact form. Related lists show up to six actual matching published posts; a new site may have fewer than four. A custom 404 offers search and category links. Slug changes create real HTTP 301 redirects; older inbound redirects are flattened and old redirect URLs cannot be reclaimed to create loops.

All publication changes use server authorization, sanitization and transactional audit events. The app uses standard request-time server rendering; Cache Components and partial prefetching were disabled after browser testing exposed a stuck editor transition with this installed Next.js version. Public responses therefore read fresh content directly; broader CDN/ISR performance tuning remains Phase 3 work. Public lookups exclude drafts, future scheduled posts, archived/unpublished/deleted records, and future publication timestamps. Preview routes require a session and return noindex/no-store. Post URLs are checked in Proxy before streaming so missing/private posts return an actual 404 rather than a streamed 200 response.

## First use

1. Open `/admin/posts/new`, choose Job listing or Article, and fill the title and body.
2. Select a category and tags. A starter category and standard job-type tags are created by `npm run setup:publishing` for local/staging use; existing content is preserved.
3. Upload an image with alt text in the right panel, select it as featured/social imagery, or insert it into the content using the editor toolbar. Images accept JPEG/PNG/WebP/AVIF, reject SVG and malformed files, enforce a 5 MB / 40 megapixel limit, and are re-encoded as WebP at a maximum 1920 × 1920 bounding box.
4. For a job, supply the employer, country, location, employment type, source URL and application URL. Check the source yourself and tick the attestation. Publishing checks link reachability safely, and reports failures as warnings without treating a responding URL as proof of legitimacy.
5. Save a draft and use Preview. For posts under 400 words, an admin must tick the short-content confirmation before publication. Near-duplicate/title/description and metadata-length checks display warnings.
6. Publish immediately or enter a local time in the displayed site timezone and choose Schedule. Invalid or ambiguous daylight-saving times are rejected. Times are stored as UTC.

The default expired-job policy is **retain** for development: keep the useful page and clearly mark it closed. The owner must review that choice and all outstanding SRS decisions before launch. Published pages automatically stop offering an Apply button when their closing date passes; the worker also persists their expired status and applies archive/remove policy when selected.

## Local services

Start PostgreSQL with `npm run db:local:start` if it is stopped, start the app with `npm run dev -- --webpack`, and run `npm run worker` in another terminal. The worker supplies a tick every 30 seconds. It calls the authenticated `/api/cron` endpoint using `CRON_SECRET` from `.env`; do not publish that secret.

Scheduled work is durable in `PublishTask`, not in the Node process. On restart, overdue tasks are picked up. Row locks and conditional status changes prevent duplicate publication. Failures roll back, retry with exponential backoff, and queue an alert after the first and fifth failed attempts. After five failures a task is held for review; use Retry in the inbox after correcting the post. Worker failures and stale heartbeat state are visible in the inbox.

Contact messages and alerts go to `MailOutbox`. As requested, when SMTP is absent locally the worker marks them **LOCAL** and the admin inbox displays them; no external email is sent. SMTP delivery can later be enabled with `SMTP_URL`, `MAIL_FROM` and `CONTACT_TO`. Failed deliveries retry and become FAILED after five attempts. External mail is at-least-once: a crash after an SMTP acknowledgement but before commit can cause a duplicate email. Contact/mail data older than twelve months is pruned by the worker.

Local images live in the ignored `.local/uploads` directory and are served at `/api/media/<random-id>.webp`. Include that directory in local backups. Outside local development, the storage adapter requires S3-compatible storage (`S3_BUCKET`, optional `S3_ENDPOINT`, `S3_REGION`, and AWS-compatible credentials). Object storage deployment was implemented but not exercised against a live provider in this session.

## Production setup still required

This work is local. Production needs its own database and secrets, S3-compatible bucket, SMTP provider, and an authenticated scheduler. The owner-selected free prototype omits the paid five-minute cron; a later supported scheduler or another host should call `/api/cron` at least every five minutes with the bearer secret. Use a process supervisor for a continuously running local/VPS worker. Configure external uptime/error monitoring so a stopped scheduler or undeliverable alert is noticed even when the application itself is unavailable. The in-app heartbeat does not replace an independent monitor.

MFA bypass remains restricted to explicit local development as requested. Staging and production ignore that flag. Staging authentication, legal text/review, AdSense, consent, structured data/sitemaps, and broader performance/accessibility release checks remain governed by the later SRS phases and gates.

## Migrations and verification

`202611160002_publishing` adds social image references, static-page update timestamps, publication tasks, contact messages, mail outbox and worker heartbeat records. It preserves the Phase 1 shared slug registry, triggers, full-text index and salary constraints. A local pre-migration database snapshot was saved to `.local/backups/pre-phase2.dump`. Restore that snapshot and the matching application revision to roll back; uploads are backed up separately.

- `npm test`: authentication and content validation, XSS sanitization, safe/optional URLs, publication requirements, salary validation and timezone handling.
- `npm run typecheck`, `npm run lint`, and `npm run build -- --webpack`.
- Apply all migrations to a disposable local database named `seo_phase2_test`, then run `npm run test:phase2`. The runner starts a production server on port 3102, runs HTTP/database checks and stops it afterward. Its fixtures are destructive **only in that specifically named test database**. It does not use the owner’s `seo_web` data.
- `CHECK_BROWSER=true npm run test:phase2` also runs the browser editor workflow and responsive overflow checks at 360, 768 and 1440 px. Set `CHROMIUM_PATH` if Chromium is installed elsewhere. Local screenshots are saved under `.local/phase2-*.png`.

The integration suite exercises preview/draft isolation, publication, sanitization, job validation and expiry, search, pagination, redirects, duplication, image conversion/rejection, roles and CSRF, taxonomy merging, bulk actions, soft deletion, scheduled publication exactly once, forced failure/retry/alert recovery, and local contact delivery. Search timing is checked on the small integration fixtures; that does not establish production performance at the SRS traffic target.
