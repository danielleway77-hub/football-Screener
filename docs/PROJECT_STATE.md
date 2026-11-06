# PROJECT_STATE.md — living handoff file (v2)

> **Update at the end of EVERY step and whenever a decision/blocker changes.** A new agent/model must be able to continue from this file + the docs it lists. Never write secrets here.

**Last updated:** 2026-11-03 · **Updated by:** (agent/model name) · **Current step:** Step 0 (not started) · **Branch:** main

## 1. Read order for a new agent
1. `AGENTS.md` 2. `PROJECT_STATE.md` 3. `PROJECT_SCOPE.md` 4. `ApplicationFlow.md` 5. `ARCHITECTURE.md` 6. `ThemeGuideline.md` 7. `UI_BLUEPRINT.md` 8. `CODING_STANDARDS.md` 9. `COMPONENT_REGISTRY.md` 10. `TESTING_STANDARDS.md` 11. `TEST_CATALOG.md` (the section for the current step) 12. `TEST_LOG.md` (latest entries) (+ `docs/reference/*` images, `RUNBOOK.md` when it exists)

## 2. Project snapshot (30 seconds)
Private single-user football screener for Danielle Way (UK). Rule: one team form > 75 and other < 35; show win/draw/away/BTTS/over 2.5 for matches 1–2 days ahead. Source: PrediGoal (subscription; login via Whop code). Stack: Next.js · Tailwind · shadcn · Framer Motion (+GSAP) · Neon+Prisma · Vercel. Theme: **Night Pitch** (dark green-black + lime accent). Offer: US$280 (client ceiling £300).

## 3. Client facts and confirmations
| Item | Value | Status |
|---|---|---|
| Thresholds exclusive (>75, <35) | **DECIDED: strict** (D5) — matches the brief's wording; example 80 vs 7 is far from the edges | ✅ decided (client may override in chat; it is a setting + one test change) |
| Form scope | **DECIDED: league form** (the default in her screenshot) | ✅ decided (setting) |
| Window | **DECIDED: tomorrow + day after** ("1–2 days ahead"); switchable to 1 day in Settings | ✅ decided |
| Daily time / timezone | **DECIDED: Europe/London; daily check 06:00 UTC (≈ 06:00–07:00 UK)** — limited by the free Vercel plan | ✅ decided |
| Image #2 (probabilities section) | **received** (`Refrence/image2.jpeg`) — "EXACT PROBABILITIES (AI)" panel: Predicted score 3–1; Win Sporting Cristal 76% · Win FC Cajamarca 8% · Draw 16%; Both teams to score Yes 54% / No 46%; Over/Under 2.5 goals Over 70% / Under 30%. Screenshot is cut off at the bottom (another card below) | ✅ received · **DECIDED:** Predicted score IS shown (when the source provides it); the unseen card below Over/Under is **out of v1** and will be added as a small add-on only if she names it (D14, D15) |
| Display order of 1X2 | **DECIDED: Home · Draw · Away** (football 1-X-2 convention; consistent on card and detail; every tile/row is labelled with its team or "Draw") (D13) | ✅ decided |
| PrediGoal API / automation permission | **Research 2026-11-03 (public pages):** no API, developer page or export is advertised (homepage, terms, App Store listing). **Terms of Service §7** prohibits misuse "including by scraping, reverse engineering" and "using automated systems without permission", and §7 also forbids copying, reselling, redistributing or commercially exploiting their analysis/data; §9 licenses **personal, lawful use** only. Support contact = **contact@predigoal.com** (homepage footer "Contact" has no email; no help centre/Discord). Plans seen: Starter free (limited daily predictions), Pro $19.99/month, Unlimited $99 one-time (no Whop mention on the homepage, although the client logs in via Whop). Terms were read via a summarising tool — **re-read https://predigoal.com/terms yourself (5 min)** before relying on this. | ⚠️ **written permission required** before any automated/assisted extraction (D17) |
| Google password exposed in chat | client told to change | ❓ confirm changed |
| Delivery date promised | chat 6 days vs offer 10 days | ⚠️ clarify |

## 4. Key decisions log
| # | Decision | Reason | Date | Status |
|---|---|---|---|---|
| D1 | Single-user password auth (bcrypt + JWT cookie) | personal use | 2026-11-03 | decided |
| D2 | Provider adapter with 3 modes; delivered mode = result of recon (Step 0.7) | data access unconfirmed | 2026-11-03 | **open** (mode: ___) |
| D3 | Theme "Night Pitch": near-black green neutrals + lime `#C8F52E` accent, coral for weak, W/D/L letters + ↑/↓ icons | client screenshot direction + accessibility research | 2026-11-03 | decided |
| D4 | Never store/use PrediGoal or Google credentials | security/ToS | 2026-11-03 | decided |
| D5 | Strict thresholds `>75`, `<35` | brief wording | 2026-11-03 | **decided** |
| D6 | Dark theme only in v1 | scope/time | 2026-11-03 | decided |
| D7 | Vercel Hobby cron once/day; `runHourLocal` informational | free tier | 2026-11-03 | decided |
| D8 | Assisted helper = **userscript** (`GM_xmlhttpRequest`) preferred over bookmarklet (CSP/CORS, token isolation); verify in recon | robustness + security | 2026-11-03 | decided (verify) |
| D9 | Window (1–2 days) governs fetching; dashboard shows all stored qualifying upcoming matches with tabs Upcoming/Today/Tomorrow/Day after | avoids "yesterday's tomorrow" bug | 2026-11-03 | decided |
| D10 | Reject (not guess) naive timestamps, bare fractions and form-scope mismatches | data integrity | 2026-11-03 | decided |
| D12 | Store only "Yes" (BTTS) and "Over 2.5"; display "No"/"Under" as 100 − value, labelled as derived; 1X2 sum must be 98–102 else reject | source integers sum to 100; guards mapping errors; keeps schema small | 2026-11-03 | decided (verify in 17.2) |
| D13 | Probability order Home · Draw · Away (football 1-X-2) instead of PrediGoal's Home · Away · Draw; Predicted score shown when available | consistency + convention; client's panel has the score | 2026-11-03 | **decided** |
| D14 | Show the Predicted score (card row B + detail hero) when the source provides it; it is optional data and hidden when absent | it is part of the panel she asked to see; near-zero cost | 2026-11-03 | **decided** |
| D15 | v1 does NOT include the unseen card below Over/Under 2.5; ProbabilityPanel is built extensible; added later as a small add-on if she names it | cannot build what we cannot see; avoids guessing | 2026-11-03 | **decided** |
| D16 | Access-mode PLAN: target **B (one-click userscript helper)** with **C (manual import)** as the guaranteed fallback; use **A (official API)** only if PrediGoal grants one. Final mode still fixed by recon Step 0.7 — **but see D17: B and A are only allowed with PrediGoal's written permission** | works for every outcome of the recon; never bypasses login/2FA | 2026-11-03 | **decided (final mode set in 0.7; constrained by D17)** |
| D17 | **No automated or assisted data extraction (modes A and B) without PrediGoal's WRITTEN permission** (ToS §7: "using automated systems without permission"; no scraping/reverse engineering; no copying/redistributing data). Request it by email to contact@predigoal.com (sent by the client or with her explicit authorisation). **If refused or unanswered by the time Step 8.3 starts:** do NOT build the helper; deliver mode **C-lite** (see below) and tell the client plainly what value it gives. | ToS compliance protects the client's subscription and you | 2026-11-03 | **decided** |
| D18 | **Mode C-lite (compliant fallback):** the owner copies what she can see herself (e.g. selects/copies the visible match page text or types values) and pastes it into the Import page; a forgiving text parser extracts form %, win/draw/win, BTTS, Over/Under and predicted score and screens them. It reduces effort but is NOT hours-saving automation; state this honestly to the client before she accepts. Optional add-on if PrediGoal later grants an API/permission: upgrade to A/B. | only compliant option without permission | 2026-11-03 | **decided (contingent)** |
| D11 | Proxy checks JWT only; `sessionVersion` check in Node (`requireSession`) | Edge runtime has no DB | 2026-11-03 | decided |

## 5. Step progress
Status values: `todo` · `in-progress` · `done` · `blocked`. A step is `done` only when tests pass **and** its bug-hunt is clean.
| Step | Title | Status | Tests | Bug-hunt | Notes / commit |
|---|---|---|---|---|---|
| 0 | Accounts, tools, data-access recon | **done (non-deployment parts)** — 0.2 ✅ 0.4 ✅ 0.8 ✅ 0.9 ✅; 0.3 GitHub & 0.6 Vercel skipped by owner; 0.1 client message + 0.7 PrediGoal recon still manual/pending | ✅ see TEST_LOG | n/a | owner approval needed before 0.5 |
| 0.5 | Install & scaffold | **done** (2026-11-05, owner approved) — 0.5.1 packages ✅ · 0.5.2 versions recorded (§5b) ✅ · 0.5.3 tooling/env/lint boundaries/folder skeleton ✅. Project at `football-screener/`, local git (3 commits, no remote) | ✅ 12 unit tests, 4 e2e, lint, typecheck, build, mutation checks (see TEST_LOG) | ✅ (1 bug found by tests and fixed) | **Step 1 NOT started — waiting for the owner's permission** |
| 1 | Agent context & docs in repo | **done** 2026-11-05 (1.1 docs in repo, commit d19edce; 1.2 context summary below + TEST_LOG, pending owner confirmation) | ✅ secret scan, format, lint | ✅ 8 contradictions logged (TEST_LOG, Step 1) | Step 2 NOT started — waiting for owner |
| 2 | Design tokens, depth system, contrast script (2.1–2.3) | **done** 2026-11-05 | ✅ 21 unit, 76 e2e, contrast 24/24, build, prod 404 | ✅ 4 bugs fixed + 7 mutations | **Step 3 NOT started — waiting for owner** |
| 2.3 | Depth system & sleek surfaces | **done** (part of Step 2) | ✅ | ✅ | |
| 6 | Authentication (6.1) | **built, review pending** 2026-11-06 | ✅ unit+integration+e2e | ✅ 6 fixed | A.12 review pending |
| 5 | Database (5.1) | **built, review pending** 2026-11-06 | ✅ 28 integration | ✅ 3 fixed | A.12 review pending |
| 4 | Routing skeleton (4.1) | **done** 2026-11-06 | ✅ 371 e2e | ✅ 2 fixed | committed 9d7bafb |
| 3 | Shared kits: layout, state, motion, interactions, brand (3.1–3.5) | **done** 2026-11-06 | ✅ 156 unit/component, 264 e2e ×3 cold, 41/41 mutations | ✅ 10+ bugs fixed | **Step 4 NOT started — waiting for owner** |
| 3.4 | Signature interaction kit (spotlight, segmented, sticky, scroll fade) | **done** (part of Step 3) | ✅ | ✅ | |
| 3.5 | Brand & illustration kit | **done** (part of Step 3) | ✅ | ✅ | |
| 4 | App shell & routing skeleton | todo | | | |
| 5 | Database | todo | | | |
| 6 | Auth | todo | | | |
| 7 | Domain: screening engine | todo | | | |
| 8 | Providers, ingest & import | todo | | | |
| 9 | Run pipeline & cron | todo | | | |
| 10 | Dashboard | todo | | | |
| 10.3 | Sticky filter bar & list polish | todo | | | |
| 10.4 | Day groups & navbar freshness pill | todo | | | |
| 11 | Match detail (11.1) + FormDuel (11.2) | todo | | | |
| 12 | Runs history | todo | | | |
| 13 | Settings & Import UI | todo | | | |
| 14 | Resilience (offline/slow/errors) | todo | | | |
| 15 | Premium animation pass | todo | | | |
| 15.2–15.3 | Design critique; real-device check | todo | | | |
| 15.4–15.5 | Delight pass; sleek tests & visual baselines | todo | | | |
| 15.6 | Micro-details, contrast modes, large-screen polish | todo | | | |
| 16 | A11y, performance, security | todo | | | |
| 17 | Production deploy + real-data check | todo | | | |
| 18 | Final audits | todo | | | |
| 19 | Handover & delivery | todo | | | |

## 5b. Installed versions (recorded 2026-11-05, Step 0.5.2) — agents MUST code against these, not memory
| Area | Version | Notes that differ from the guide |
|---|---|---|
| Runtime / tools | Node **v26.12.0** · npm 11.20.0 · pnpm **12.16.1** (installed via npm; Corepack no longer ships with Node) · Git 2.56 | ⚠️ **Prisma officially supports Node 20.19+/22.12+/24 only** — works so far, but install Node 24 LTS before Step 5 if anything misbehaves |
| Framework | Next **16.4.5** (Turbopack) · React **19.3.0** · TypeScript 5.9.3 | `next.config.ts` has **`cacheComponents: true`** and **`partialPrefetching: true`** by default → dynamic data (cookies/headers/DB) must be read inside `<Suspense>`/dynamic boundaries or opted into caching (`'use cache'`); check the Next 16 docs before writing pages. **Confirmed from the installed docs: `middleware` is deprecated and renamed `proxy` (file `src/proxy.ts`, export `proxy`, Node.js runtime by default)** |
| Styling | Tailwind **4.3.4** (`@tailwindcss/turbopack`, CSS-first `@theme`) · tw-animate-css | no tailwind.config file |
| UI | shadcn **4.23.0**, style **radix-nova** (Radix base, neutral, Lucide), `radix-ui` 1.8.1, `sonner` 2.0.8, `next-themes` 0.4.6 | shadcn's `cn()` now comes from the **`cn`** package (official shadcn-ui; `src/lib/utils.ts` re-exports it) — `clsx` and `tailwind-merge` are installed too but unused by generated code. The **`form`** component is no longer in the registry: `react-hook-form` 7.91.0 + `@hookform/resolvers` 7.0.2 installed manually (use shadcn `field` or plain RHF) |
| Validation / dates | zod **4.6.7** · date-fns **4.4.0** · date-fns-tz **3.2.0** (use `toZonedTime`/`fromZonedTime`) | zod 4 API (check differences from v3) |
| Animation | framer-motion **14.9.1** · gsap 3.15.1 | |
| Database | `@prisma/client` **7.10.1** · `prisma` CLI **7.10.1** (aligned: npm's `latest` for the CLI is 8.0.0-rc.30, a release candidate — do NOT use it) | Prisma 7: `prisma.config.ts`, driver adapters (e.g. `@prisma/adapter-pg`/neon), no engine binary at runtime ("Query Compiler: enabled") — read the v7 docs in Step 5 |
| Auth | jose 6.2.15 · bcryptjs 3.0.3 | |
| Testing | vitest **5.1.0** · @testing-library/react 16.3.3 · jest-dom 7.0.1 · user-event 14.6.8 · msw **3.0.3** · @playwright/test **1.64.1** (+ chromium installed) · @axe-core/playwright 4.14.0 · jsdom 30.1.3 | `@types/node` raised to **24.19.2** (vitest peer) |
| Quality | prettier 3.9.10 · prettier-plugin-tailwindcss 0.8.1 · eslint 9.39.5 + eslint-config-next 16.4.5 + eslint-config-prettier 10.1.8 · tsx 4.23.15 · cross-env 10.1.0 | |
| pnpm policy | `pnpm-workspace.yaml` `allowBuilds`: esbuild ✓, @prisma/engines ✓, prisma ✓; sharp ✗, unrs-resolver ✗, workerd ✗ | pnpm 12 blocks install scripts until approved; "agent skills awaiting approval: prisma" is left unapproved on purpose |
| Theme implementation notes (Step 2) | Tailwind colour tokens: `bg-canvas` (page, NOT `base`: collides with `text-base`), `bg-subtle`, `bg-surface(-raised/-overlay)`, `border-hairline(-strong)`, `border-border-control`, `text-faint`, `bg-primary-soft`, `text-positive/negative/warning/info/violet`. Fonts self-hosted (Fontsource variable) via next/font/local. `--text-faint` = #7C8E87. Radius ladder via `rounded-sm/md/lg/xl/2xl` = 8/12/16/20/24 and `rounded-4xl` = pill. Button sizes: default 44 · sm 36 · lg 52. Dev style guide at `/style-guide` (404 in production) with a built-in rule checker | |
| Step 3 implementation notes | (1) Hooks: `useHydrated` (marker only), `useAnimateOnMount` (decided once at mount: first server paint is never animated/hidden), `useOnlineStatus`, `useSlowRequest`, `useHoverCapable`. (2) Key client roots expose `data-hydrated` (Navbar, style guide) — browser tests wait for it. (3) `lib/fetcher.ts` = only client fetch path (15 s timeout, GET-only retries, 401 handler). (4) Every new page/component must pass the overflow guard (`tests/e2e/overflow.spec.ts`, add new routes to its list). (5) Next 16: `usePathname` lives inside `<Suspense>`; no `new Date()` in server components. (6) Production start requires `APP_PASSWORD_HASH` (Step 6) — for earlier local production checks pass a throwaway bcrypt-shaped value via the process environment only. (7) Dev-only routes: `/style-guide`, `/style-guide/shell`, `/style-guide/sticky` (404 in production) | |
| Known harmless warning | `unmet peer effect` (from @effect/sql-* inside Prisma's optional tooling) | ignore |

## 6. Currently working on
— (none)

## 7. Next action
Start Step 0.1: send the client message (change password, send image #2, confirm questions).

## 8. Blockers
| # | Blocker | Owner | Since |
|---|---|---|---|
| B1 | Data-access mode unknown — **needs PrediGoal's written permission (email contact@predigoal.com)**; no API is advertised and ToS §7 prohibits unpermitted automation. Until answered, build everything except Step 8.3 (helper) and keep mode C/C-lite working | dev + client | 2026-11-03 |
| B2 | ~~Image #2 missing~~ **resolved 2026-11-03**; remaining questions were **decided by the developer** (D13–D15) so they no longer block the build | – | 2026-11-03 |
| B3 | Client unresponsive since 2026-11-02 01:37 (dev pinged 03 Nov) | client | 2026-11-03 |

## 9. Testing status
No tests yet. Last full run: – · Coverage: domain –% / services –% · Lighthouse: – · axe: –

## 10. Known issues / tech debt
None.

## 11. Proposed (not approved) changes
(none) — see `PROJECT_SCOPE.md` §14 change control.

## 12. Environments and accounts (no secrets!)
| Item | Owner now | Status | Notes |
|---|---|---|---|
| GitHub repo `football-screener` | developer | – | transfer to client at Step 19 |
| Vercel project | developer | – | URL: – |
| Neon project | developer | – | region: – ; branches: production (default), dev, test |
| Domain | – | – | optional |
| Ingest tokens | – | – | list labels only |

## 13. Session log (append newest at top)
| Date | Agent/model | Did | Next |
|---|---|---|---|
| 2026-11-03 | docs author | Created docs v2 | Step 0 |

## 14. Handoff checklist (before switching agent/model/session)
[ ] Section 5 table current [ ] Section 6/7 filled [ ] Decisions/blockers current [ ] Tests green or failures listed in §10 [ ] Registry updated [ ] Everything committed and pushed [ ] Paste the **Session Resume Prompt** (master guide §0.6) into the new session


Step 5 notes: Prisma 7.10.1 works on Node 26 (validate/generate). Prisma schema engine gets P1001 to Neon on this machine → migrations applied by scripts/db-migrate.ts (pg). Tests use DIRECT_URL_TEST with search_path=test. Adapter: @prisma/adapter-pg.

Step 6 notes: APP_PASSWORD_HASH in .env.local must escape every $ as backslash-$ (Next dotenv expansion). Dev/e2e password lives in git-ignored .env.test.local (E2E_PASSWORD). Session cookie: session (dev) / __Host-session (prod). Version-mismatch redirect -> /login?expired=1.
