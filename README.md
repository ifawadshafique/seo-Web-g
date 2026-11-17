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

See [Phase 2 publishing and worker setup](docs/phase-2.md) for the editor, scheduler, uploads, contact delivery and verification. Start `npm run worker` alongside the development server for scheduled posts and local inbox processing.

Phase 3 adds structured data, crawl outputs, moderation, staging ad layouts, Cookiebot/GA4 integration and CSP reporting. See [Phase 3 setup and remaining staging gates](docs/phase-3.md). Live ads remain off until approval and consent configuration.

Run `npm run build` for the production build. `npm run test:performance` checks mobile list/post performance with ads off and staging placeholders (three samples per scenario). For a deployed protected staging site, run `npm run check:staging -- https://your-staging-host.example` with its Basic credentials configured privately.
