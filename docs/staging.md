# Free staging prototype

Use a dedicated Vercel project with its own Neon PostgreSQL database and private Blob image store. Keep its actual deployment URL, account setup, resource IDs and verification receipts in private local records, not this public repository.

## Source and deployment workflow

Source is maintained in GitHub and GitHub Actions runs checks on pushes. The owner-selected workflow uses explicit deployments through the connected Vercel app; native Vercel Git auto-deployment is not configured. ChatGPT can push and deploy requested updates after checking them. Connecting apps does not make it continuously develop features without a task.

Use the project's Vercel Production target with `APP_ENV=staging`; this remains a protected prototype rather than the launch environment. Preview deployments are disabled until independent preview databases are configured. Keep deployment protection, application Basic authentication, noindex and hosted MFA enabled.

## Configuration and migrations

`npm run prepare:staging` creates private credentials in the Git-ignored `.local/` directory without overwriting existing values. Configure the fixed HTTPS hostname, the managed database and storage in the project's encrypted environment settings. Do not copy development credentials or customer data into the hosted database.

Use a pooled `DATABASE_URL` for application traffic and a matching unpooled `DIRECT_URL` for Prisma CLI migrations. `prisma.config.ts` selects `DIRECT_URL` when available. `npm run check:staging-env` validates configuration without contacting the database. `npm run build:staging` validates it, applies versioned migrations, and builds the app. Migrations through transaction poolers can leave session-level advisory locks behind; keep their connection direct.

For images, set `MEDIA_STORAGE=vercel-blob` and provision a private store with its server-side token. The adapter uses immutable WebP object keys and the existing media endpoint. The S3 adapter is still available for other environments.

For read-only checks against layered Vercel protection, configure `VERCEL_AUTOMATION_BYPASS_SECRET` privately. The staging checker sends it only to the selected origin and does not follow credential-bearing redirects. It does not grant an administrative session or replace Basic authentication and MFA. Root canonical URLs and sitemap URLs are normalized before comparison and deduplication.

## Deferred prototype operations

The owner selected the free prototype. The checked-in Vercel configuration has no paid five-minute cron schedule. Scheduled publishing, expiry persistence, notification retries and uninterrupted CSP observation need an explicitly run external worker or a later supported scheduler. A private worker credential can invoke the GET cron endpoint; it grants no access to other pages or administrative operations. Deadline-based closed status and schema removal still work on request.

Live ads remain disabled. SMTP, real Cookiebot domain/TCF configuration, original acceptance-test content and release sign-off remain separate tasks. The staging checker intentionally fails AC-3 until at least five eligible jobs and five original articles exist; do not publish fabricated jobs to force it to pass. No seven-day observation is established by fixtures or occasional visits.

Run type checking, lint, unit tests, the integration/browser suites and mobile measurements before release. Keep private deployment receipts out of Git. Dependency audit still flags an unpatched glob-matching advisory in build/test dependencies and moderate transitive issues; the prototype is not a launch security sign-off.
