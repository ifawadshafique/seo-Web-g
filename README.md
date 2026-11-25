# Job posting website

Next.js App Router, TypeScript, PostgreSQL, Prisma, and Tailwind CSS.

Phase 1 provides login with MFA, revocable sessions, roles and audit logging. Phase 2 adds the publishing editor, jobs/articles, uploads, categories/tags, scheduled publishing, public search and pages, and a local contact inbox.

See [Phase 1 setup and verification](docs/phase-1.md) for environment configuration, migrations, account creation, recovery, and test commands. The complete requirements are in [SRS v1.2](SRS-Job-Posting-Website-v1.2.md); outstanding platform decisions are tracked in [Phase 0](docs/phase-0-decisions.md).

```sh
npm ci
# Configure .env as described in docs/phase-1.md
npm run db:migrate
npm run dev
```

Open http://localhost:3000/login. There are no built-in login credentials.

### Draft publishing from Claude or ChatGPT

The Streamable HTTP connector is available at `<SITE_URL>/api/mcp` once OAuth is configured. It supports content search, category lookup, job and article draft creation, title and body edits on existing drafts, and draft site pages for administrators. Review drafts in `/admin`.

Configure a trusted OAuth authorization server for the Claude and ChatGPT clients. It must advertise OAuth discovery metadata and support authorization code with PKCE. Configure it to issue short-lived RS256 or ES256 JWT access tokens with the connector URL as the audience and `content:drafts` in the `scope` claim. Register the callback URLs from each client or configure a supported client registration method.

In Vercel, set `MCP_OAUTH_ISSUER` to the exact token issuer, `MCP_OAUTH_JWKS_URL` to its signing key endpoint, and `MCP_OAUTH_SUBJECT` to the authorized operator's immutable OAuth subject. Set `MCP_STAFF_USER_ID` to that operator's numeric user ID in the site's staff database. Use the staging site's URL for the staging audience and verify an authenticated draft there before enabling the production connector. The staging connector must be reachable from the client with OAuth bearer authentication.

See [Phase 2 publishing and worker setup](docs/phase-2.md) for the editor, scheduler, uploads, contact delivery and verification. Start `npm run worker` alongside the development server for scheduled posts and local inbox processing.

Phase 3 adds structured data, crawl outputs, moderation, staging ad layouts, Cookiebot/GA4 integration and CSP reporting. See [Phase 3 setup and remaining staging gates](docs/phase-3.md). Live ads remain off until approval and consent configuration.

Run `npm run build` for the production build. `npm run test:performance` checks mobile list/post performance with ads off and staging placeholders (three samples per scenario). For a deployed protected staging site, run `npm run check:staging -- https://your-staging-host.example` with its Basic credentials configured privately.

See [the free staging prototype and GitHub setup](docs/staging.md) for hosting status, private account setup and the deferred scheduler.

Phase 4 is in progress. See [recovery tooling and remaining launch gates](docs/phase-4.md) for encrypted backups, isolated restore drills and the remaining launch evidence.
