# TEST_LOG.md — evidence that each step was tested

> Append one block per step (newest at the bottom). Paste **real command output summaries** (not "passed"). Never include secrets or personal data. A step is not "done" in `PROJECT_STATE.md` until its block here shows green results.

## Template (copy for each step)
```
### Step X.Y — <title> — <date> — <agent/model>
Branch/commit: <name> @ <short sha>
Commands run:
  pnpm lint        → ✅ 0 errors / 0 warnings
  pnpm typecheck   → ✅
  pnpm test        → ✅ <N> tests, <N> files; coverage domain <xx>% services <xx>%
  pnpm e2e         → ✅ <N> passed (projects: mobile, tablet, desktop, wide)
  pnpm test:ui     → ✅ / n/a
  pnpm build       → ✅ (route sizes noted if relevant)
Catalog tests implemented (TEST_CATALOG §X.Y): <n of n>  (list any added)
Mutation checks: <change> → <test that failed> → reverted ✅   (≥ 1 for domain/services/auth)
Manual script results: <step-by-step ✓/✗ with notes>
Responsive: 360 ✓ 768 ✓ 1280 ✓ 1920 ✓ (screenshots: docs/reference/ui-review/<step>/)
A11y: axe 0 serious/critical ✓ · keyboard-only ✓ · reduced-motion ✓
Bug & Gap hunt: <n> findings (P0 0, P1 0, P2 0, P3 n) all P0–P2 fixed ✓
Known issues / deferred: <list or none>
```

## Log

### Step 0 — Accounts, tools, environment (non-deployment parts) — 2026-11-05 — Claude (Sonnet 5.5)
Scope decision (owner): GitHub (0.3) and Vercel (0.6) SKIPPED for now; 0.1 (client message) and 0.7 (PrediGoal recon) are manual and NOT done; Neon database supplied by the owner (dev use, replaced by the client's at handover).
Checks:
  0.2 tools        → ✅ node v26.12.0 · npm 11.20.0 · git 2.56.0.windows.2 · VS Code present · pnpm was missing → installed via `npm i -g pnpm` → pnpm 12.16.1 (Node 26 no longer bundles Corepack)
  0.4 Neon         → ✅ pooled URL connects (PostgreSQL 18.6, db `neondb`, role neondb_owner, public schema empty); direct URL (host without `-pooler`) connects; `channel_binding=require` works with `pg` but was dropped from the stored URL (sslmode=require is enough; avoids Prisma incompatibility risk)
  0.8 secrets      → ✅ SESSION_SECRET and CRON_SECRET generated (64 hex chars each, distinct), stored only in git-ignored `.env.local`
  0.9 env plan     → ✅ `.env.local` contains DATABASE_URL, DIRECT_URL, SESSION_SECRET, CRON_SECRET, NEXT_PUBLIC_APP_URL, INGEST_ALLOWED_ORIGINS; values re-tested by reading them back from the file (both DB URLs connect; keys present; secrets ≥ 32 chars)
  git hygiene      → ✅ `.gitignore` has `.env*`; `git check-ignore -v .env.local` confirms; no env file is tracked
Also done early (first command of Step 0.5.1, before the owner asked to stop after Step 0): `create-next-app` created `D:\WEB DEV\Daniel\football-screener` — Next.js 16.4.5, React 19.3.0, Tailwind 4.3.4, TypeScript 5.9.3, ESLint 9.39.5, pnpm, local git repo with one initial commit, NO remote. Nothing else from 0.5 or Step 1 has been run.
Known issues / deferred (Step 0 continued below): Neon has a single database (no production/dev/test branches) → tests will use a separate Postgres schema in the same database (Step 0.5.3); the DB password was pasted in chat → rotate it when the database is handed to the client; Node 26 is very new → watch for library compatibility in Step 0.5.

### Step 0.5 — Project installation and tooling (0.5.1, 0.5.2, 0.5.3) — 2026-11-05 — Claude (Sonnet 5.5)
Branch/commit: local `main` (no remote) @ 5b71d54 (packages) and 7d219d5 (tooling). GitHub/Vercel push skipped by owner.
Commands run (all in `football-screener/`):
  pnpm build            → ✅ Next 16.4.5 Turbopack, 2 routes, TypeScript ok
  pnpm dev              → ✅ HTTP 200 on / (before tooling) and via Playwright webServer
  pnpm format:check     → ✅ (whole repo formatted once with Prettier + tailwind plugin)
  pnpm lint             → ✅ 0 errors / 0 warnings (shadcn components included)
  pnpm typecheck        → ✅ strict + noUncheckedIndexedAccess + noImplicitOverride
  pnpm test             → ✅ 2 files, 12 tests (11 env-validation + 1 tooling); jsdom project has no tests yet
  pnpm test:cov         → ✅ runs; coverage reports 0/0 (no domain/service code yet — thresholds are switched on in Steps 7/8)
  pnpm test:tz          → ✅ 12/12 under TZ=UTC and under TZ=Asia/Karachi
  pnpm e2e              → ✅ 4/4 (mobile 390, tablet 768, desktop 1280, wide 1920) `home route responds`
Catalog tests implemented (TEST_CATALOG §0.5.3): all — env error lists every missing var · SESSION_SECRET < 32 rejected · public env exposes only NEXT_PUBLIC_ keys · smoke on 4 viewports · fail-fast manual · lint-boundary manual · mutation checks. Extra tests added: CRON_SECRET length, non-postgres URL, no secret values in error text, APP_PASSWORD_HASH required only in production + bcrypt format, origin list rules (path / http on public host rejected), empty-string optionals.
Bug found by the tests and fixed: `parseServerEnv` replaced the custom "APP_PASSWORD_HASH is required in production" message with the generic "is required (not set)"; fixed by applying the generic wording only to `invalid_type` issues.
Mutation checks: SESSION_SECRET min 32→8 → 2 tests failed (`rejects SESSION_SECRET shorter than 32`, `never prints variable values`) → reverted ✅ · origin refine removed → `rejects ingest origins that include a path…` failed → reverted ✅ · restored → 12/12 green.
Manual checks: fail-fast — with SESSION_SECRET="too-short" the dev server printed "Invalid environment variables: - SESSION_SECRET: must be at least 32 characters … Values are never printed." and neither the short value nor the real CRON_SECRET appeared in output ✅ · lint boundary — probe files importing `@prisma/client` and `@/server/repositories/*` from components and `next/server`/`react` from domain produced 4 errors; an allowed `zod` import in domain passed; probes deleted ✅ · client bundle scan — SESSION_SECRET, CRON_SECRET and the DB password not present in `.next/static` ✅ (weak evidence until env is imported by real code; re-check in Step 6/16).
Git hygiene: `.env.local` and `.env.test.local` ignored and untracked; `.env.example` contains no real secrets; Playwright output folders added to `.gitignore` (they were staged by mistake and unstaged before committing).
Deviations from the guide (all recorded in PROJECT_STATE §5b): shadcn 4.23 asks for a component base and preset → `-b radix -p nova` (style `radix-nova`, neutral, Lucide); its `cn()` now comes from the official `cn` package; the `form` component no longer exists → react-hook-form + @hookform/resolvers installed manually; pnpm 12 requires `allowBuilds` approvals (esbuild, @prisma/engines, prisma allowed; sharp, unrs-resolver, workerd denied); `prisma` CLI pinned to 7.10.1 because npm `latest` is 8.0.0-rc.30 (client is 7.10.1); `@types/node` raised to 24 for vitest; `vitest.config.mts` (ESM) to avoid a Vite loader warning; `pnpm lint` runs `eslint .`; docs/ NOT copied into the repo (that is Step 1, not started); no GitHub push.
Risks carried forward: Node v26.12 is not on Prisma's supported list (20.19+/22.12+/24+) — CLI works, re-test in Step 5 and install Node 24 LTS if anything misbehaves · Next 16 has `cacheComponents` + `partialPrefetching` enabled → read the Next 16 docs (local: node_modules/next/dist/docs) before building pages, and check whether `middleware` is now `proxy` · single Neon database → tests use schema `test` (mechanism validated in Step 5) · DB password was pasted in chat → rotate at handover.
