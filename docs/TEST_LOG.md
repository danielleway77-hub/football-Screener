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

### Step 1 — Agent context and documentation in the repo (1.1, 1.2) — 2026-11-05 — Claude (Sonnet 5.5)
Commit: local `main` @ d19edce (no remote).
1.1: 12 docs copied to `football-screener/docs/` (everything except MASTER_GUIDE.md); `docs/reference/` holds client-image-1.png, client-image-2.jpeg, mira-brief.pdf; root `AGENTS.md` = Next.js block kept + project rules appended; `CLAUDE.md` = same content. Secret scan of docs/AGENTS/CLAUDE: only the Neon role name `neondb_owner` (not a secret). format:check, lint green.
1.2 (context load, no code written) — contradictions/ambiguities found in the docs vs reality:
  C1 Prisma 7: ARCHITECTURE §4 shows `generator client { provider = "prisma-client-js" }`; Prisma 7 uses `prisma-client` with an explicit output path, `prisma.config.ts` and a driver adapter (decide in Step 5 from the v7 docs).
  C2 Neon: TEST_CATALOG/TESTING_STANDARDS/Steps 0.4, 5.1, 17 assume production/dev/test BRANCHES; the real setup is ONE database → tests use schema `test`; production = a separate database/project later.
  C3 Next 16: `middleware` may now be `proxy`; `cacheComponents` is ON, so dynamic reads (cookies, DB) need Suspense/`use cache` rules — Steps 4/6/10 must follow node_modules/next/dist/docs.
  C4 Zod 4 / shadcn 4 / msw 3 / vitest 5 API differences vs the guide's examples (`form` component gone; `cn` from the `cn` package).
  C5 UI_BLUEPRINT §4 still draws a StatsStrip; §22 Bento summary supersedes it (noted in the file).
  C6 ThemeGuideline §6.5/Step 10.1 describe a 5-tile grid in places; the final design is compact 3+2 pair tiles on cards and ProbabilityPanel on detail (image #2).
  C7 Node 26 is outside Prisma's supported range (Step 5 risk).
  C8 Probability order: PrediGoal shows Home·Away·Draw; we use Home·Draw·Away (D13).
Owner action needed before Step 8.3: PrediGoal written permission (D17).

### Step 1 follow-up — contradictions C1–C8 fixed in docs — 2026-11-05
C1 ARCHITECTURE generator -> prisma-client + output (verify in Step 5); lint rule + .gitignore cover src/generated. C2 single-DB wording: tests use schema test (guarded), production = separate project (AGENTS, MASTER_GUIDE, ARCHITECTURE, TESTING_STANDARDS, TEST_CATALOG). C3 CONFIRMED from installed docs: middleware renamed proxy (src/proxy.ts, Node runtime) — all docs updated, Edge wording removed. C4 CODING_STANDARDS 12b lists verified API differences. C5 StatsStrip removed (BentoSummary). C6 5-tile/5-probability wording replaced. C7 Node gate added to Step 5.1. C8 recorded as decision D13 (Home, Draw, Away).

### Step 2 — Design tokens, themed primitives, contrast script, depth system (2.1, 2.2, 2.3) — 2026-11-05 — Claude (Sonnet 5.5)
Branch/commit: local `main` (no remote). Dev server and production build both exercised.
Commands run:
  pnpm format:check / lint / typecheck → ✅ clean
  pnpm test            → ✅ 21 tests (12 env/tooling + 9 contrast)
  pnpm test:tz         → ✅ under TZ=UTC and TZ=Asia/Karachi
  pnpm contrast        → ✅ 24/24 required pairs (23 hard checks + 1 informational lime-vs-coral 2.19:1)
  pnpm e2e             → ✅ 76 passed on 4 viewport projects (smoke 1 + style-guide 12 + surfaces 6, ×4)
  pnpm build           → ✅; production `/style-guide` → HTTP 404, `/` → 200
Catalog tests implemented: §2.1 (button 36/44/52, input 44, body 16px, --primary rgb(200,245,46), fonts loaded, loading keeps width + aria-busy, disabled, focus outline ≥2px solid, no horizontal scroll at 360, reduced-motion shimmer off, rule checker 0 violations, prod 404 manual) · §2.2 (ratio of black/white = 21, parses hex+rgba, composites translucent colours, resolves var(), thresholds enforced, required pairs present, all pass, fails when a pair is under threshold) · §2.3 (card border 1px alpha ≤ .14, no resting outer shadow, dialog shadow, .glass backdrop-filter, .num tabular-nums, radius ladder + no pure black/white). Extra: regression test for the colour-token collision, selected-tab pill.
Bugs found and fixed (3 by tests/inspection, 1 by eyes): (1) shadcn `outline-none` overrode the global focus outline → removed from all 21 components; (2) `--color-base` collided with Tailwind's `text-base` font-size class → every `text-base` element rendered in the page-background colour (invisible card titles/input text); renamed to `canvas`; found by SCREENSHOT REVIEW, not by the automated suite → regression test added; (3) `--text-faint` #7B8D86 was 4.498:1 on --surface-overlay (the hand-computed docs said 4.5) → #7C8E87 (4.56); docs updated; (4) checkbox 4px radius and white slider thumb broke the radius-ladder / no-pure-white rules → 8px/20px checkbox, lime thumb.
Mutation checks (all caught, all reverted): contrast min 4.5→3 (initially NOT caught → added threshold test → caught) · --text-faint too dark → contrast test · button h-11→h-10 → height test · card radius 13px → ladder test · card resting shadow → shadow test · outline-none back on Button → focus test · text-base colour collision → regression test.
Manual/visual: reviewed screenshots of buttons, forms, cards, elevation and homepage at 1280 (and cards at 390): hairline cards, lime only on primary/qualifying/focus, readable glass, visible focus rings.
Deviations (all deliberate): fonts are SELF-HOSTED with Fontsource variable fonts via next/font/local (next/font/google timed out fetching gstatic from Node, breaking dev/e2e) — Space Grotesk / Inter / JetBrains Mono as specified · shadcn variant names kept (default = primary lime, outline added; sizes: default 44, sm 36, lg 52, xs 32, icons) · Button `loading` keeps width by rendering children invisibly under a spinner · Card gets `interactive` prop · toasts: dark-only (no next-themes), top-center offset 72px on <768px, bottom-right otherwise · forced-state attributes (`data-force`) exist only for the style guide · default Next homepage replaced by a small themed placeholder (Step 4 builds the real shell) · `--font-*` families are named spaceGrotesk/inter/jetbrains by next/font/local (tests match loosely).
Known issues / deferred: icon.svg and OG assets not created yet (Steps 3.5/15) · Tooltip/Dropdown/Select popups were restyled only through tokens (popover = surface-raised) — verify visually when first used in Step 3 · light theme intentionally not supported.

### Step 2 follow-up fixes — 2026-11-05
Fixed the open items from Step 2: (1) favicon — default `favicon.ico` removed, `src/app/icon.svg` (Screener glyph) added; (2) floating layers verified: new `tests/ui/popups.spec.ts` (select, dropdown, tooltip, sheet, dialog, toast, favicon) + dropdown demo in the style guide; mutation `--popover: #fff` → 2 tests failed → reverted; dropdown menu min-width 12rem (items were wrapping); (3) flakiness: the tooltip test hovered before hydration and Playwright's dev server was cold → tests wait for networkidle, tooltip uses retry-until-visible, and `webServer.url` polls `/style-guide` so the heaviest route is compiled before the 4 workers start. Result: 100/100 e2e on three consecutive COLD starts (`.next` deleted each time).
Own mistake caught by the suite: a PowerShell string replace dropped `${baseURL}` from `playwright.config.ts` (→ 18 failures); fixed in the editor, not by script.
