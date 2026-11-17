# Phase 0: Decisions and setup

Tracks Gate 0 (SRS §10.1): decisions signed, staging deploys from CI.

## ADR-SRS-09: Platform decision

| Item | Decision | Criterion check |
| --- | --- | --- |
| Hosting | Vercel **Pro** (paid plan; Hobby forbids commercial use) | PLT-1 ✅ (re-verify terms at signing), PLT-4 on-demand revalidation ✅, PLT-5 custom headers via `next.config.ts` ✅ |
| Database | Managed PostgreSQL (Neon or Supabase) — one DB per environment | ENV-1 |
| ORM | Prisma, version-controlled migrations (`prisma migrate`) | ENV-5, DM-8 |
| Authentication | `iron-session` sealed handles + PostgreSQL sessions + TOTP via `otplib` + per-request session version checks (see phase-1.md) | PLT-3 ✅ (revocation by deleting sessions / bumping version) |
| Scheduler | Phase 2 implementation: PostgreSQL durable tasks, retry/alert outbox and worker heartbeat; local 30-second runner; Vercel five-minute cron configuration supplied (production deployment/monitoring pending) | PLT-2 (Vercel Cron alone lacks retries → pair with job table + error tracker) |
| Object storage | Phase 2: local image storage for development; S3-compatible adapter implemented, production provider/bucket pending | — |
| Email | Owner chose local inbox during development; SMTP delivery adapter implemented, production provider pending | — |
| Error tracking | **TBD** — Sentry | NFR-12 |
| Uptime monitor | **TBD** — e.g. Better Stack / UptimeRobot | NFR-3 |
| CMP | Cookiebot integration prepared at owner request (Phase 3); real account/domain/TCF configuration pending | AD-4 |
| CI | GitHub Actions: typecheck, lint, test, build on every push | ENV-3 |
| Package manager | npm | — |
| Canonical hostname | **TBD** | SEO-5 |

## Appendix B status

| # | Item | Status |
| --- | --- | --- |
| 1 | Production domain / preferred hostname | ⏳ Open |
| 2 | Hosting, DB hosting, backups | ✅ Vercel Pro + managed Postgres (backup retention ≥14 days to confirm, NFR-4) |
| 3 | Site timezone | ✅ `Asia/Karachi` |
| 4 | Expired-job policy (LC-10) | ⏳ Open |
| 5 | Soft-delete retention / who may hard-delete | ⏳ Open (proposal: 30 days, admin only) |
| 6 | Consent platform + jurisdictions | Cookiebot integration prepared at owner request; actual account/domain and jurisdiction review pending |
| 7 | Ad placements, sizes, fallback | Six placements and reserved responsive sizes implemented; real staging/owner acceptance pending |
| 8 | Release 1 = Must + Should | ⏳ Confirm |
| 9 | Initial content target + editorial process | ⏳ Open |
| 10 | Operational owner | ⏳ Open |
| 11 | Legal counsel + start date (LEG-1) | ⏳ Open — **start in week 1** |
| 12 | Auth solution vs PLT-3 | ✅ iron-session + DB sessions + TOTP (Phase 1 implementation decision) |

## Environments (ENV-1, ENV-2, ENV-6)

| Env | Database | Ads mode | Indexing | Access |
| --- | --- | --- | --- | --- |
| local | local PostgreSQL (private `.env`) | `off` | `noindex` | open |
| staging | managed Postgres (staging branch) | `placeholder` | `noindex` | protected (Vercel deployment protection / basic auth) |
| production | managed Postgres (main) | `off` until AdSense approval | indexable | public |

Secrets live only in `.env` (git-ignored; CLI and app) or `.env.local` (app only) and the host's env settings; `.env.example` documents the keys.

## Gate 0 checklist

- [ ] Repository scaffolded (Next.js, TypeScript, Tailwind, ESLint) — in progress
- [ ] Prisma + env validation + `APP_ENV` / `ads_mode` guard
- [ ] CI workflow committed
- [ ] Seed script guarded against production (ENV-4)
- [ ] GitHub repo created and pushed
- [ ] Vercel project linked; staging + production env vars set
- [ ] Staging deploys from CI and is protected + `noindex`
- [ ] Open Appendix B items signed by the owner
- [ ] Legal review started
