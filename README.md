# Football Match Screener

A private, single-user dashboard that screens football fixtures 1–2 days ahead for the rule
**one team's recent form above 75% and the other's below 35%**, and shows the win / draw / away,
both-teams-to-score, over/under 2.5 and predicted-score figures for the matches that qualify.

> Status: scaffolding (Step 0.5). Project documentation lives in the master guide / `project-docs`
> folder next to this repository and is copied into `docs/` in Step 1.

## Prerequisites

- Node.js 24 LTS recommended (works on newer versions, but Prisma officially supports 20.19+, 22.12+ and 24+).
- pnpm 12 (`npm install -g pnpm`; Corepack no longer ships with Node).
- A Neon Postgres database (development), connection strings in `.env.local`.

## Setup

```powershell
pnpm install
Copy-Item .env.example .env.local   # then fill in the values (see comments in the file)
pnpm dev                            # http://localhost:3000
```

The environment is validated when the server starts (`src/instrumentation.ts` → `src/lib/env.ts`):
a missing or invalid variable stops the app with a readable message (values are never printed).

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js development server / production build / production server |
| `pnpm lint` / `typecheck` | ESLint (incl. architecture boundary rules) / `tsc --noEmit` |
| `pnpm test` / `test:cov` / `test:tz` | Vitest unit + component + integration tests / with coverage / under two timezones |
| `pnpm e2e` | Playwright on 4 viewports (mobile, tablet, desktop, wide); `PW_PROD=1` tests a production build |
| `pnpm test:ui` | Visual/"sleek" acceptance suite (added in Step 15.5) |
| `pnpm format` / `format:check` | Prettier |
| `pnpm db:generate` / `db:migrate` / `db:deploy` / `db:studio` / `db:seed` | Prisma (from Step 5) |
| `pnpm hash-password` / `run:daily` / `contrast` | Added in Steps 6 / 9 / 2.2 |

## Architecture rules (enforced by lint)

`app/ → server/services → server/repositories → lib/db`. Components never touch the database;
`src/server/domain` is pure TypeScript with no Next, React or Prisma imports.
