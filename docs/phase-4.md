# Phase 4: hardening and launch preparation

Phase 4 is in progress. The protected free staging prototype is not a public launch or a completed security sign-off.

## Recovery

`npm run backup:create` creates an authenticated AES-256-GCM archive in the ignored `.local/recovery/` directory. It contains a PostgreSQL custom dump, every referenced uploaded image, and the dotenv configuration selected by `DOTENV_CONFIG_PATH` (default `.env`). Database records and media references are read from the same repeatable-read snapshot used by `pg_dump`. Runtime database credentials are passed to PostgreSQL tools through their environment rather than command arguments. Use a direct connection for managed databases.

For staging, run:

```sh
DOTENV_CONFIG_PATH=.local/staging.env npm run backup:create
```

The command prints paths, never credentials or content. The archive and independent random key are created with mode 600. Move the key to a separate secure location and keep an encrypted off-machine copy of the archive; keeping both only on the development computer does not protect against loss of that computer. The backup includes sensitive credentials and personal data. Do not commit either file. Rotated credentials need a fresh backup.

Use PostgreSQL client tools compatible with the source server. `PG_DUMP` and `PG_RESTORE` can select their executable paths. This prototype tool has a 256 MiB in-memory archive limit; use a streaming backup system before exceeding it. Only media represented by database records is included. Provider account settings, DNS, external email and consent accounts must be documented separately in a private operations record.

Set `RESTORE_ADMIN_URL` privately to a **local** PostgreSQL administrative connection, then run:

```sh
npm run backup:drill -- /private/path/backup.enc /private/path/backup.key
```

The drill refuses remote restore servers, generates a fresh database name and never overwrites an existing database. It checks every public table's row count and content fingerprint, verifies every media reference and image checksum, recovers configuration, and revokes copied sessions in the restored database. The source database is never changed. Evidence, recovered configuration and images remain private under `.local/recovery/seo_restore_*/`. A failed drill can leave its disposable database for diagnosis; remove it manually after review.

The recovered environment file contains the **original service endpoints**. It is recovery material, not a ready-to-run test environment. Before starting an application against a restored database, configure its new database and media paths, use isolated service credentials, and disable mail, ads and scheduling. Never run a restored worker against the original service endpoints by accident.

A successful manual drill demonstrates recovery at that moment. It does not establish scheduled daily backups, 14-day retention, off-machine storage or an operational recovery SLA. Those remain pending until configured and observed.

## Remaining launch gates

| Gate               | Required evidence                                                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security review    | Review current dependency audit, resolve applicable findings, verify roles, MFA, session revocation, sanitization, uploads and private caching with the integration suites. |
| Durable operations | Supported scheduler and delivered failure alerts; successful restart and retry tests. Free prototype scheduling remains deferred.                                           |
| CSP enforcement    | Seven real uninterrupted staging days for the current policy, reviewed violations and approved evidence. Occasional visits and fixtures do not qualify.                     |
| Content            | At least 20 original reviewed posts; at least five eligible jobs and five articles for structured-data checks; reviewed legal pages published.                              |
| Legal              | Written legal opinion on file, required changes applied, owner approval.                                                                                                    |
| Search             | Search Console and Bing ownership verified, sitemap submitted, current Rich Results checks recorded.                                                                        |
| Consent and ads    | Real consent-platform configuration and regional checks, accurate privacy/cookie copy and provider approval. Live ads remain off.                                           |
| Release            | Current CI, protected-staging checks, mobile performance and accessibility evidence; all AC-1 through AC-22 reviewed and owner sign-off recorded.                           |

Keep actual deployment URLs, account identifiers, credentials, legal documents and detailed verification receipts in private records. Do not remove staging protection, enable paid services or mark these gates complete just to pass a checklist.

## Verified technical work

The protected staging database completed a fresh encrypted backup and a clean restore into an isolated PostgreSQL 18.7 server. All 25 public tables matched by row count and content fingerprint; the referenced image matched its SHA-256 checksum; configuration was recovered; copied sessions were revoked. UTC-normalized fingerprints prevent timezone differences from producing false mismatches. Private drill receipts contain the actual archive and restore details.

The earlier PostgreSQL 18.4 incompatibility is resolved for this workspace by an isolated 18.7 toolchain under `.local/toolchains/pgsql-18.7/`. The system installation and existing development cluster were not changed. For repeat drills, select compatible tools with `PG_DUMP` and `PG_RESTORE`; the restore server must also support the source archive's metadata. Source code and checksums were obtained from the [official PostgreSQL release directory](https://ftp.postgresql.org/pub/source/v18.7/). Do not strip metadata or ignore restore errors.

Security hardening now bounds authentication JSON to 4 KiB, ordinary administrative JSON to 64 KiB, and post/page JSON to 1 MiB before parsing. Streamed bodies are bounded even without Content-Length. Oversized requests return 413 with private cache headers. Integration checks cover authentication and authenticated settings rejection in addition to MFA, revocation, roles, CSRF and draft isolation.

The external worker supports the existing staging platform protection credential, sends it only to the configured staging origin, and refuses redirects. It validates the response and reports failed publication tasks. Run it with `DOTENV_CONFIG_PATH=.local/staging.env npm run worker` on an operator-managed always-on host; a laptop process is not proof of continuous availability. Do not expose these credentials in frontend code, URLs or public workflow logs.

The dependency audit on 20 November 2026 reported zero known vulnerabilities after targeted Effect, minimatch and fast-uri patches. Scope-limited overrides preserve the existing Prisma and Next.js major versions. See the [Effect advisory](https://github.com/advisories/GHSA-7589-6fvf-x4pw) and [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249). This is a dated audit result, not a guarantee against future vulnerabilities. CI pins its actions to exact commits, uses read-only repository permissions, and runs `npm run check:dependencies` on every push and pull request.

Local verification passed the production build, 55 unit tests, lint, TypeScript checks, authentication security integration, publishing integration/browser checks, and search/moderation/consent integration/browser checks. Fixtures demonstrate behavior; they do not establish real-provider approval or owner sign-off.

## Read-only release report

Run `DOTENV_CONFIG_PATH=.local/staging.env npm run check:release` to measure actual published content, eligible schema samples, legal-page publication, worker freshness and current-policy CSP observation. It writes a private `.local/release-readiness.json` report. The command exits nonzero while launch evidence remains outstanding; configured verification tags or provider IDs never count as account verification or approval.

The current staging report has zero published posts, no eligible job/article samples, missing published About/Privacy/Terms/Disclaimer pages, missing provider verification configuration and a stale worker/CSP heartbeat. Start continuous observation only after the selected worker host is operational; a stale window does not count toward the seven days.

Remaining work requires an always-on worker and delivered alerts, daily retained off-machine backups, original reviewed content and accurate legal pages, written legal review, real consent-provider checks, webmaster verification and sitemap submission, actual-staging post/list mobile measurements, seven real uninterrupted CSP days, and owner acceptance of AC-1 through AC-22. Vercel hosting alone does not establish these gates. Keep the free protected prototype and live ads off until those requirements are met.

The latest local mobile run exceeded the 200 ms blocking-time target on the listing page. Its raw samples are retained privately. This remains a failed measurement; CI repeats the same budgets, and actual-staging measurements remain a separate gate. No performance threshold was relaxed.
