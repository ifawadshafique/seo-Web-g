# Phase 1: Foundation

Implemented locally: Prisma 7 schema and initial PostgreSQL migration, password login, MFA enrollment and verification, recovery codes, database-backed sessions, authorization, an admin shell, and audit logging. Staging rollout is still an environment task; this document does not certify Gate 0 or launch readiness.

## Authentication decision

Use `iron-session` to seal an opaque cookie handle, PostgreSQL for authoritative session state, `bcryptjs` (cost 12) for passwords, and `otplib` for TOTP. This replaces the Phase 0 proposal of Auth.js database sessions: the application implements its credentials and MFA flow explicitly, using these maintained libraries. Server checks validate the database session and user version on every protected read or operation. Both admin and editor accounts enroll MFA before accessing the admin area.

The database stores only a SHA-256 digest of each random session handle. Cookies are HttpOnly, SameSite=Strict, and Secure in production builds. Pending login challenges expire after five minutes and allow five verification attempts. Verified sessions have a twelve-hour absolute limit and a thirty-minute inactivity timeout. Successful verification rotates the handle. Sign out removes the current session; sign out all devices increments the user session version and deletes all sessions.

TOTP secrets are encrypted using AES-256-GCM. Used TOTP time steps cannot be reused. Ten random recovery codes are shown once at enrollment, stored only as digests, and consumed atomically. Recovery login invalidates other sessions. Keep the encryption key in the host secret manager and a protected recovery location; losing it makes authenticator secrets unreadable. There is no public endpoint to reset MFA or create an account. If both the authenticator and recovery codes are lost, the owner must perform a controlled database recovery and revoke sessions; never disable MFA by an unauthenticated request.

Login has persistent account and IP attempt limits (five attempts per fifteen-minute fixed window, including successful password attempts). On local development, all clients share a conservative IP bucket. Set `TRUST_PROXY=true` only where the deployment proxy overwrites `X-Forwarded-For`; configure that proxy to pass the real client address. Expired `LoginBucket` and `Session` rows can be periodically pruned by the database operator.

POST authentication requests require an exact Origin match to `SITE_URL`. Admin and authentication responses are private/no-store and noindex. Role checks are centralized in `src/lib/auth.ts`: editors access content only; users, settings, ads (via the settings permission), and audit data require ADMIN. Future Phase 2 mutations must call this guard and write their audit event in the same database transaction as the change.

## Set up and run

1. Install packages with `npm ci` (generates the Prisma client).
2. Copy `.env.example` to `.env`. CLI scripts load `.env`; Next.js also supports `.env.local`.
3. Set `DATABASE_URL` to your development PostgreSQL database and `SITE_URL` to the exact app origin. Generate `AUTH_ENCRYPTION_KEY` with `openssl rand -hex 32` and save the output privately in the environment file.
4. Run `npm run db:migrate`. The initial migration is intended for an empty database. If a database already contains application tables, back it up and reconcile/baseline its schema before applying this migration; do not reset it.
5. Create an account using the command below. Supply a password of at least 14 characters and at most 72 UTF-8 bytes.
6. Run `npm run dev`, visit `/login`, add the displayed secret to a TOTP authenticator, enter its code, and store the recovery codes privately. Continue to `/admin`.

```sh
read -rs 'account_password?New admin password: '
printf '%s' "$account_password" | npm run user:create -- owner@example.com "Site Owner" ADMIN
unset account_password
```

This example uses zsh. Account provisioning requires trusted shell/database access, creates no default password, and writes an audit event. Use `EDITOR` instead of `ADMIN` for an editor account.

## Migrations and recovery

Apply migrations on staging before production with `npm run db:migrate`. Take a database snapshot first. The initial migration adds the core entities, foreign keys, indexes, salary constraints, and a trigger-backed shared slug registry for posts/pages. Raw SQL constraints and triggers are part of the migration and must be preserved in later migrations.

For rollback, stop application writes and restore the pre-migration snapshot into a replacement database, then restore the previous application version and point it at that database. Prisma deploy migrations do not automatically reverse schema changes. Restore media configuration and `AUTH_ENCRYPTION_KEY` from the secret manager; secrets are not embedded in database migrations.

## Verification

- `npm test`: environment, seed protection, password hashing, encryption integrity, TOTP, role boundaries, and session validity.
- `npm run typecheck` and `npm run lint`.
- `npm run build -- --webpack`: production build verified using webpack because the execution environment prevents a Turbopack worker from opening its required socket. Normal unrestricted environments can use `npm run build`.
- `npm run test:integration`: real HTTP and PostgreSQL checks for MFA enrollment, invalid codes, recovery/reuse denial, session revocation, inactivity, role enforcement, Origin checks, login limits, draft isolation, disabled writes, audit events, and database slug/salary constraints.

Integration tests require a **disposable** database named `seo_phase1_test`; they truncate its application fixtures. Apply migrations there and run the app with the same DATABASE_URL, SITE_URL, and AUTH_ENCRYPTION_KEY as the test process. The CI workflow does this using an isolated PostgreSQL service. Never point this test at a database whose contents you need.

## Phase 2 boundary

Public APIs return only published, nondeleted records with a nonfuture publication timestamp, and select safe author fields. Existing placeholder write endpoints were removed: unsupported mutation methods return 405 until Phase 2 implements authorization, sanitization, publication validation, and transactional audit logging. Public API responses currently omit the body; sanitized full-content rendering belongs to Phase 2. The admin shell offers account/session controls, admin-only user inspection, and recent audit events. It does not yet provide publishing tools.

## Current local setup

The development database is `seo_web` at localhost:5432. A project-local PostgreSQL 18 cluster is stored in the git-ignored `.local/postgres` directory. It uses password authentication; credentials remain in `.env`. Start it after a reboot with `npm run db:local:start` and stop it with `npm run db:local:stop`. These commands use this machine's PostgreSQL installation path.

The initial migration is applied and the `admin@gmail.com` administrator (display name `admin`) has been provisioned. Its generated initial password is in `.local/admin-login.txt` (owner access only, ignored by Git). Open `/login` to enroll an authenticator and save recovery codes; enrollment requires the owner's authenticator and has not been completed automatically.

## Temporary local MFA bypass

Owner requested postponing MFA during development. `.env` currently sets `LOCAL_AUTH_SKIP_MFA=true`. This works only when `APP_ENV=local` and `NODE_ENV=development` (next dev). Password verification, rate limits, session expiration, and role checks still apply. Staging and production ignore the flag. Bypassed sessions remain marked unverified, so turning the flag off invalidates them and the next login requires MFA enrollment or verification. Set `LOCAL_AUTH_SKIP_MFA=false` and restart the dev server to restore MFA.
