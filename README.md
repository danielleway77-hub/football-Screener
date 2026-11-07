# Football Match Screener

A private, single-user dashboard that screens football fixtures 1-2 days ahead for the rule
**one team's recent form above 75% and the other's below 35%**. For each match that qualifies it shows
win / draw / away, both-teams-to-score (Yes/No), over/under 2.5 goals and the predicted score.

Data comes from the owner's own PrediGoal subscription. Without PrediGoal's written permission the
only data path is **manual import** (smart paste of a match page, or a JSON/CSV file). See
[`docs/PROJECT_SCOPE.md`](docs/PROJECT_SCOPE.md) section 10. The tool gives no betting advice.

## Who reads what

| You are                 | Read                                                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The client (end user)   | [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md)                                                                                                                                              |
| The operator / owner    | [`docs/RUNBOOK.md`](docs/RUNBOOK.md), [`docs/DEPLOYMENT_RUNBOOK.md`](docs/DEPLOYMENT_RUNBOOK.md)                                                                                        |
| Running the client call | [`docs/HANDOVER_CHECKLIST.md`](docs/HANDOVER_CHECKLIST.md)                                                                                                                              |
| A developer             | this file, then [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/AGENTS.md`](docs/AGENTS.md), [`docs/TESTING_STANDARDS.md`](docs/TESTING_STANDARDS.md)                            |
| Wanting the history     | [`docs/CHANGELOG.md`](docs/CHANGELOG.md), [`docs/TEST_LOG.md`](docs/TEST_LOG.md), [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md)                                                      |

## Stack

Next.js 16 (App Router, Turbopack, `cacheComponents`) · React 19 · TypeScript (strict) · Tailwind CSS 4 ·
shadcn/ui (Radix) · Framer Motion (+ GSAP for the login entrance) · Neon Postgres with Prisma 7
(`@prisma/adapter-pg`) · zod 4 · jose + bcryptjs · Vitest + Testing Library + MSW · Playwright + axe · pnpm 12.
Hosting target: Vercel (with one Vercel Cron job).

## Prerequisites

- Node.js 24 LTS recommended (Prisma supports 20.19+, 22.12+, 24+; newer versions have worked so far).
- pnpm 12 (`npm install -g pnpm`; Corepack no longer ships with Node).
- A Neon Postgres database. Use a separate project or branch for production.

## Setup

```powershell
pnpm install
Copy-Item .env.example .env.local   # fill in the values, see below
pnpm db:migrate                      # apply migrations (see Windows notes)
pnpm db:seed                         # creates the single Setting row
pnpm dev                             # http://localhost:3000
```

`pnpm db:seed:dev` also loads fixture matches (development only).

### Environment variables

`.env.example` is the single list (a test checks that it and the deployment runbook agree). The environment is
validated at server start (`src/instrumentation.ts` -> `src/lib/env.ts`): a missing or invalid value stops the
app with a readable message, never printing the value.

| Name                                                   | Required               | Notes                                                                         |
| ------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`                                         | yes                    | Neon **pooled** string (host has `-pooler`), `?sslmode=require`. Secret.      |
| `DIRECT_URL`                                           | yes                    | Neon **direct** string (no `-pooler`); used by migrations. Secret.            |
| `SESSION_SECRET`                                       | yes                    | At least 32 characters. Secret.                                               |
| `CRON_SECRET`                                          | yes                    | At least 32 characters, different from `SESSION_SECRET`. Secret.              |
| `APP_PASSWORD_HASH`                                    | required in production | bcrypt hash from `pnpm hash-password`. Secret.                                |
| `NEXT_PUBLIC_APP_URL`                                  | yes                    | The only `NEXT_PUBLIC_` variable. Used for origin checks.                     |
| `INGEST_ALLOWED_ORIGINS`                               | yes                    | Comma-separated https origins for the ingest endpoint CORS list.              |
| `PROVIDER_API_BASE`, `PROVIDER_API_KEY`                | no                     | Only if an official data API is ever granted (mode A).                        |
| `LOG_LEVEL`                                            | no                     |                                                                               |
| `DATABASE_URL_TEST`, `DIRECT_URL_TEST`, `E2E_PASSWORD` | tests only             | Put in git-ignored `.env.test.local`.                                         |

Generate secrets with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

**The `$` escaping lesson.** bcrypt hashes contain `$`, which Next's dotenv-expand treats as a variable
reference. In `.env.local` escape every `$` as `\$` (for example `APP_PASSWORD_HASH=\$2b\$12\$abc...`); this is
what worked in Step 6. `.env.example` and the deployment runbook also mention single quotes as an alternative.
If the hash is mangled the app stops at start with "APP_PASSWORD_HASH must be a bcrypt hash". In the Vercel UI
paste the raw hash with no quotes and no escaping. Details:
[`docs/DEPLOYMENT_RUNBOOK.md`](docs/DEPLOYMENT_RUNBOOK.md) section 1.

## pnpm scripts

| Script                                     | What it does                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `dev` / `build` / `start`                  | Next.js dev server / production build / production server                                         |
| `lint` / `typecheck`                       | ESLint (including the architecture boundary rules) / `tsc --noEmit`                               |
| `format` / `format:check`                  | Prettier write / check                                                                            |
| `test` / `test:watch` / `test:cov`         | Vitest (unit, component, integration) / watch / coverage                                          |
| `test:tz`                                  | Vitest under `TZ=UTC` and again under `TZ=Asia/Karachi` (proves date logic is timezone safe)      |
| `e2e` / `test:ui`                          | Playwright end-to-end / the visual "sleek" acceptance suite (run against a production build)      |
| `db:generate` / `db:migrate` / `db:deploy` | Prisma client / apply migrations with `pg` (works where Prisma's engine fails) / `prisma migrate deploy` |
| `db:migrate:test`                          | `db:migrate` against the test schema (`PRISMA_ENV=test`)                                          |
| `db:verify`                                | Read-only check that the target database has the expected tables, indexes and constraints         |
| `db:seed` / `db:seed:dev` / `db:studio`    | Seed the Setting row / plus fixtures / Prisma Studio                                              |
| `hash-password`                            | Prompts (hidden) and prints a bcrypt hash for `APP_PASSWORD_HASH`                                 |
| `token:create "label"`                     | Creates an ingest token and prints it once (the Settings page does the same)                      |
| `run:daily`                                | Calls the daily cron route (`BASE_URL` selects the target)                                        |
| `prod:smoke`                               | Post-deploy smoke checks against `BASE_URL` (see the deployment runbook)                          |
| `contrast` / `secret-scan`                 | Colour contrast check of the theme tokens / scan tracked files for secrets                        |
| `make-icons` / `make-og`                   | Regenerate app icons / social images                                                              |

## Architecture

Layers (enforced by ESLint boundary rules): `src/app` (routes, route handlers) -> `src/server/services` ->
`src/server/repositories` -> `src/lib/db`. Components never touch the database. `src/server/domain` is pure
TypeScript (screening rule, window, normalisation, page-text parser, zod schema) with no Next, React or Prisma imports.

| Folder                                   | Holds                                                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(app)`                          | Dashboard `/`, `/matches/[id]`, `/runs`, `/import`, `/settings` (all behind login)                                                                       |
| `src/app/(auth)/login`                   | Login page                                                                                                                                               |
| `src/app/api`                            | `auth/login`, `auth/logout`, `health`, `run`, `runs/[id]`, `import`, `ingest`, `settings` (+ `password`, `rescreen`), `tokens` (+ `[id]`), `cron/daily` |
| `src/proxy.ts`                           | Session gate (JWT check only; the session version is checked in Node by `requireSession`)                                                                |
| `src/server/providers`                   | The three data modes: `official-api`, `assisted-ingest`, `manual-import`                                                                                 |
| `src/components`, `src/hooks`, `src/lib` | UI kit, hooks, shared helpers (fetcher, formatters, security headers, env)                                                                               |
| `prisma/`                                | `schema.prisma`, migrations, seed                                                                                                                        |
| `tests/`                                 | `unit`, `components`, `integration`, `e2e`, `ui`, `fixtures`, `helpers`                                                                                  |

Authentication: single password, bcrypt, signed session cookie (`__Host-session` in production, `session` in
dev). Every API route needs the session except login, logout and health; `/api/cron/*` needs `CRON_SECRET`;
`/api/ingest` needs an active ingest token. The default `accessMode` is **manual import**. The helper and API
modes exist in code, but the helper is not offered in the UI (the Import page says it is not available yet)
without PrediGoal's permission (decision D17).

## Testing

```powershell
pnpm lint; pnpm typecheck; pnpm format:check
pnpm test                    # unit + component + integration
pnpm test:tz                 # run under two timezones
pnpm e2e                     # Playwright
pnpm build; pnpm test:ui     # visual acceptance on a production build
```

**Integration and e2e isolation rules.** These tests write to a real Postgres, so they must never touch dev or
production data.

- Put `DATABASE_URL_TEST` / `DIRECT_URL_TEST` in git-ignored `.env.test.local`, each with `?schema=test` (or
  `?schema=test_<name>`).
- The suites refuse to run unless the schema is exactly `test` or `test_<name>` (lowercase letters and digits).
  `public` is rejected.
- Parallel sessions or worktrees each use their own `test_<name>` schema in the same database. Create it with
  `pnpm db:migrate:test`.
- Specs that share a schema must run with `--workers=1`.
- `E2E_PASSWORD` is the plaintext password Playwright signs in with; its hash is the `APP_PASSWORD_HASH` the
  dev server uses.

Test evidence per step is in [`docs/TEST_LOG.md`](docs/TEST_LOG.md); the expected tests per step are in
[`docs/TEST_CATALOG.md`](docs/TEST_CATALOG.md).

## Windows notes

- **Prisma schema engine `P1001`.** On the development PC Prisma's Rust schema engine cannot reach Neon (Node's
  `pg` can), so `prisma migrate deploy` fails with `P1001`. Use **`pnpm db:migrate`**: it applies
  `prisma/migrations/*/migration.sql` with `pg` and records each in `_prisma_migrations`, as Prisma does. It
  reads `DIRECT_URL`. `pnpm db:generate` still works.
- If `pnpm` is not found, close and reopen PowerShell.
- pnpm 12 blocks dependency install scripts until approved; the allow-list is in `pnpm-workspace.yaml`.

## Daily job (cron)

`vercel.json` schedules `GET /api/cron/daily` at `0 6 * * *` (06:00 **UTC**: about 06:00 UK in winter, 07:00 in
summer; the Hobby plan allows once a day and may start it up to an hour late). Vercel sends
`Authorization: Bearer $CRON_SECRET` itself; anything else gets 401. In official-API mode it pulls and screens
the window; in the push modes (including manual import) it only records a SKIPPED run, which the Runs page
hides by default. Each call also deletes matches more than 90 days past kickoff, login attempts older than 30
days and rate-limit rows older than 2 days, and marks runs stuck in RUNNING for over 10 minutes as FAILED. A
second call within 30 minutes of a finished cron run returns `{skipped: "recent"}`. `Setting.runHourLocal` is
informational; the schedule is not derived from it.

## Deploying

Manual, owner accounts required: follow [`docs/DEPLOYMENT_RUNBOOK.md`](docs/DEPLOYMENT_RUNBOOK.md). Operating
it afterwards: [`docs/RUNBOOK.md`](docs/RUNBOOK.md).
