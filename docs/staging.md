# Free staging prototype and GitHub automation

The owner selected a free prototype on 17 November 2026. Vercel team `orcusflame490-6564s-projects` is on Hobby. This supersedes the earlier Pro assumption for the prototype; commercial launch and its operational gates remain separate.

The protected Vercel project is `seo-web-g-staging`, with fixed domain `https://seo-web-g-staging.vercel.app`. The first application deployment is READY and its protected public routes, noindex, owner MFA requirement and private image uploads/optimization were verified. Its source repository is `https://github.com/ifawadshafique/seo-Web-g` (public). The private Blob image store is `seo-web-g-staging-images` in Singapore. The free Neon PostgreSQL project is `seo-web-g-staging` in Singapore, with an independent staging database. Current resource IDs and deployment receipts are saved privately in `.local/deployment-state.json`.

## Deployment behavior

Use a dedicated staging project. Its Vercel Production target runs the application with `APP_ENV=staging`; the target name does not make it the public launch environment. The owner explicitly skipped the Vercel Git link. Source is on GitHub’s `main` branch and CI runs on pushes; deployments are performed explicitly through the connected Vercel app when requested. Preview deployments are disabled until isolated preview databases are configured. GitHub CI runs the checks independently; native Vercel Git deployments do not automatically wait for every GitHub CI check unless additional deployment checks are configured.

ChatGPT can edit and push source when asked and authorized through the GitHub connection. GitHub runs CI after pushes; the Vercel app starts deployments explicitly when requested. Connecting the apps does not make ChatGPT autonomously write features or run continuously without a task.

`npm run build:staging` validates protected staging configuration, then runs the versioned Prisma migrations and the production Next.js build. Invalid configuration fails before migrations. Do not point this build at a live application's database. `npm run check:staging-env` runs the preflight without connecting to the database. A separate launch project/build policy must be reviewed before production.

## Private configuration

`npm run prepare:staging` creates `.local/staging.env` with fresh encryption, Basic-auth and worker credentials. It never replaces an existing file or copies local authentication secrets. Set the actual staging database URL and fixed hostname there; keep the file private. The existing development `.env` and admin account are unchanged. `.env`, `.local`, `.vercel`, uploads, database dumps and reports are excluded from Git.

Use `MEDIA_STORAGE=vercel-blob` and the staging project's `BLOB_READ_WRITE_TOKEN`. The media adapter stores already-converted WebP images privately, uses immutable application keys, and reads them through the existing authorization-checked media endpoint. The S3 adapter remains available for other environments. Configure the real Cookiebot ID only after registering the staging hostname; leave ads approval false and CMP/analytics IDs blank until then.

## Free-plan limits and pending operations

The checked-in `vercel.json` deliberately has no five-minute cron schedule: the owner chose Hobby, which cannot supply the planned schedule. Scheduled publishing, expiry persistence, notification retries and uninterrupted CSP observation therefore need an explicitly run external worker or a later supported paid scheduler. Deadline-based public/schema closure still works on request. Keep the prototype's scheduling and seven-day CSP gate marked pending; ordinary visits and test fixtures are not proof of continuous monitoring.

A manual authenticated worker can call `/api/cron` with the private worker credential. Vercel's Bearer credential is accepted only on that GET endpoint through staging's Basic gate. A worker credential never grants access to other pages or administrative APIs. Vercel's platform-level deployment protection is a separate gate and requires an authorized automation bypass when called externally.

Live ads remain off. This is a personal staging prototype, not a commercial launch. Database and Blob free quotas still apply; no paid plan or automatic billing upgrade was selected.

Dependency review: the Blob SDK’s transitive Zod dependency is constrained to the application’s patched compatible version. npm audit still flags an unpatched picomatch advisory in build/test dependencies and moderate transitive advisories; do not interpret the protected prototype as launch security sign-off.

## Verification receipt

Source commit `f61a1dba80ff4de26b59adf375c0b48244e4189d` was deployed successfully. GitHub CI run `44140685668` completed successfully, including mobile performance checks. Local checks passed 49 unit tests, type checking, lint, build and Phase 3 integration/browser checks. These checks do not certify all release gates or real Cookiebot settings.

The owner account is `admin@gmail.com` / `admin`. Its staging password and the separate site gate credentials are in the git-ignored `.local/staging-admin-login.txt`; sign into the authorized Vercel account before opening staging, then complete MFA enrollment in your own authenticator. A locked deployment-verification editor and one small verification image retain the image-upload audit trail; that editor has no usable interactive password or active verification session. No local development password or data was copied to the hosted database.

The owner chose to skip connecting Vercel Git on 17 November 2026. The connected app can deploy a specific GitHub commit, so ChatGPT can push and deploy updates when asked. GitHub pushes alone do not trigger Vercel deployments in this setup.

For layered Vercel deployment protection, the read-only staging checker also accepts `VERCEL_AUTOMATION_BYPASS_SECRET` from private configuration. It sends this header only to the explicitly selected staging origin and never follows redirects with credentials. The bypass grants no administrative session and does not replace the application's Basic or MFA checks.

The real staging checker passed the implemented protection, robots, sitemap/RSS, metadata, canonical, image-attribute and nonce checks, and stopped at AC-3 because the empty prototype has no five eligible jobs/five original articles. This remains pending; no fabricated job content was published to satisfy it. The manual authenticated worker endpoint was also verified successfully. SMTP delivery, continuous scheduling, real CMP configuration and release acceptance remain pending.
