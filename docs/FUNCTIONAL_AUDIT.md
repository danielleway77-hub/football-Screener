# FUNCTIONAL_AUDIT.md — full functionality audit (Steps 0-16 merged on master)

Branch `audit-functional` (worktree `football-screener-audit`). Audit order follows MASTER_GUIDE Step 18 (18.1 quality/code/security, 18.3 data pipeline/reliability, 18.4 flows, 18.5 scope traceability). 18.2 (UI/UX visual audit) is run by the separate UI polish branches and not repeated here; axe was done in Step 16.

Legend: PASS = implemented and proven by a passing automated test; GAP = not implemented or not proven (each GAP is explained and classified in section 6). File paths are relative to the repo root. Test ids: `U` = `tests/unit`, `C` = `tests/components`, `I` = `tests/integration`, `E` = `tests/e2e`, `UI` = `tests/ui`, `ACC` = `tests/integration/acceptance.test.ts` (added by this audit).

## 1. Run evidence (real numbers)

__RUNS__

## 2. Client acceptance examples through the real pipeline

`tests/integration/acceptance.test.ts` drives the real route handlers (`POST /api/ingest` with a bearer token, `PUT /api/settings` with a session cookie) into the run service, an isolated Postgres schema (`test_audit`) and the dashboard/detail services. Nothing below the routes is mocked. The e2e specs `dashboard.spec.ts`, `import.spec.ts` (smart paste of the golden text) and `match-detail.spec.ts` prove the same values in the browser against the production build.

| Acceptance example | Result | Proof |
|---|---|---|
| Sporting Cristal 80 / FC Cajamarca 7 qualifies, strong HOME; win 76 / draw 16 / away 8; BTTS Yes 54 (No 46); Over 70 (Under 30); predicted 3-1 | PASS | ACC test 1 (stored row + derived No/Under), E `match-detail.spec.ts` "ProbabilityPanel shows predicted score ... golden values", E `dashboard.spec.ts` "golden" |
| Atletico 44 / Bayern 56 does not qualify | PASS | ACC test 2, U `screening.test.ts` |
| 75/35 does not; 76/34 does | PASS | ACC test 2, U `screening.test.ts` (also 75/34 and 76/35, float edges) |
| Away-strong 30/82 qualifies (strongSide AWAY) | PASS | ACC test 2 |
| Threshold change 70/40 re-screens stored matches (and back to 75/35) | PASS | ACC test 3, I `settings.test.ts` "PUT saves, and changed thresholds re-screen", E `settings.spec.ts` "save at 70/40 re-screens" |
| Kickoff window in Europe/London on DST days (25 h on 2026-10-25, 23 h on 2026-03-29), tab membership at the edges | PASS | ACC test 5, U `window.test.ts`, I `cron.test.ts` "DST day" |
| Duplicate/idempotent ingest (same payload 3x = one row) | PASS | ACC test 4, I `api.test.ts` "is idempotent", I `run-service.test.ts` |
| Stale-data banner | PASS | ACC test 6 (26 h boundary), E `dashboard.spec.ts` "stale banner appears at 30 hours", C `freshness-pill.test.tsx` |
| Login / logout / password change flows | PASS | E `auth.spec.ts` (login, lockout, next, logout), I `settings.test.ts` (password change bumps sessionVersion, keeps current session), E `settings.spec.ts` "password: wrong current ... signs another out" |

## 3. Traceability matrix — functional requirements (PROJECT_SCOPE section 6)

| ID | Requirement | Implemented in | Proven by | Status |
|---|---|---|---|---|
| FR1 | Strict `> high` and `< low`, either side strong, both-high/both-low never | `src/server/domain/screening.ts` | U `screening.test.ts` (15 cases) | PASS |
| FR2 | Window = tomorrow(+1) by owner-TZ date, DST safe; dashboard view = stored qualifying `kickoffAt >= now`, tabs by owner-TZ today | `src/server/domain/window.ts`, `src/server/services/match-service.ts`, `src/server/services/cron-service.ts` | U `window.test.ts`, U `day-groups.test.ts`, I `dashboard.test.ts`, I `cron.test.ts`, ACC | PASS |
| FR3 | Both forms + win/draw/win + BTTS + O/U + predicted score; missing = "Unavailable"; No/Under = 100 - value | `src/components/match/ProbabilityPanel.tsx`, `MatchCard.tsx`, `screening.ts` (`bttsNo`, `under25`) | U `screening.test.ts`, C `match.test.tsx`, E `match-detail.spec.ts`, I `database.test.ts` (null not 0), ACC | PASS |
| FR3b | 1X2 sum 98-102 else item rejected with reason | `src/server/domain/schema.ts`, `normalize.ts` | U `normalize.test.ts` | PASS |
| FR4 | Idempotent, unique `(provider, providerMatchId)` | `prisma/schema.prisma`, `src/server/repositories/matches.ts` `upsertMany` | I `database.test.ts`, I `run-service.test.ts`, I `api.test.ts`, ACC | PASS |
| FR5 | Failed run keeps earlier data, readable error | `src/server/services/run-service.ts` (`storeBatch` transaction), `cron-service.ts` | I `run-service.test.ts` (rollback, storage error), I `cron.test.ts` "provider failure" | PASS |
| FR6 | Stale banner after `staleAfterHrs` (26) | `match-service.ts` `getRunStats`, `components/states/StaleBanner.tsx`, `FreshnessPill.tsx` | I `run-service.test.ts` run stats, E `dashboard.spec.ts`, E `resilience.spec.ts`, ACC | PASS |
| FR7 | Settings validated, Re-screen transactional | `src/lib/schemas/settings.ts`, `settings-service.ts`, `run-service.ts` `rescreenAll`, DB CHECK constraints | U `settings-schema.test.ts`, I `settings.test.ts`, I `database.test.ts` (CHECK), E `settings.spec.ts` | PASS |
| FR8 | Session on all but `/login`, `/api/auth/*`, `/api/health`; cron secret; ingest token | `src/proxy.ts`, `src/server/auth/guard.ts`, `cron-service.ts` `isValidCronAuth`, `ingest-service.ts` | U `auth.test.ts`, U `route-inventory.test.ts`, I `security.test.ts`, I `cron.test.ts`, E `security.spec.ts` (every page and API) | PASS |
| FR9 | Acceptance fixtures 80/7, 30/82, 76/34, 75/35, 44/56, 50/50 | `screening.ts` | U `screening.test.ts`, ACC | PASS |
| FR10 | One RUNNING run; duplicates return the running run | DB partial unique index, `repositories/runs.ts` `createRunning`, `run-service.ts` | I `database.test.ts` "two parallel createRunning", I `run-service.test.ts`, I `api.test.ts` 409 RUN_IN_PROGRESS | PASS |
| FR11 | Ingest <= 500 matches / 1 MB; invalid items reported, valid stored (PARTIAL) | `src/app/api/ingest/route.ts`, `domain/normalize.ts`, `server/http.ts` `readLimitedText` | U `normalize.test.ts` (exactly 500), I `api.test.ts` (413 declared and streamed, PARTIAL, 422), I `run-service.test.ts` (500 batch) | PASS |
| FR12 | Filters/sort/day in URL, survive reload/back | `src/lib/schemas/dashboard.ts`, `components/dashboard/MatchFilters.tsx` | U `dashboard.test.ts`, E `dashboard.spec.ts` "filters update the URL and survive reload and Back" | PASS |
| FR13 | Times shown in configured timezone | `src/lib/format.ts` (`formatInTimeZone`) | U `format.test.ts` (run under TZ=UTC and TZ=Asia/Karachi), I `dashboard.test.ts` | PASS |
| FR14 | Login 5 failures / IP / 15 min | `src/server/auth/rate-limit.ts`, `repositories/login-attempts.ts`, `app/api/auth/login/route.ts` | U `auth.test.ts`, I `auth.test.ts`, E `auth.spec.ts` "5 failures show the lockout" | PASS |
| FR15 | Tokens shown once, hashed, revocable, 30/h | `server/services/token-service.ts`, `ingest-service.ts` (`INGEST_LIMIT_PER_HOUR`), `components/settings/TokenManager.tsx` | I `api.test.ts` (hash only, 31st = 429), I `settings.test.ts`, E `settings.spec.ts` tokens | PASS |
| FR16 | Form scope mismatch rejected with reason | `screening.ts` `checkFormScope`, `run-service.ts` | U `screening.test.ts`, I `run-service.test.ts` | PASS |
| FR17 | Naive timestamps and ambiguous fractions rejected | `domain/normalize.ts`, `domain/percent.ts` | U `normalize.test.ts`, U `import.test.ts`, E `import.spec.ts` | PASS |
| FR18 | Password change invalidates other sessions | `server/services/password-service.ts`, `guard.ts` (sessionVersion) | I `settings.test.ts`, I `api.test.ts` stale session, E `settings.spec.ts` | PASS |
| FR19 | RUNNING > 10 min auto-FAILED, never blocks | `repositories/runs.ts` `expireAbandoned`, `run-service.ts`, `app/api/runs/[id]/route.ts` | I `run-service.test.ts` (10 min boundary), I `database.test.ts`, I `runs-list.test.ts`, I `cron.test.ts`, I `api.test.ts` | PASS |

## 4. Traceability matrix — user flows (ApplicationFlow section 6) and in-scope items

| Flow | Implemented in | Proven by | Status |
|---|---|---|---|
| 6.1 Login, `next` redirect, lockout, open-redirect guard | `app/(auth)/login/page.tsx`, `components/auth/LoginForm.tsx`, `lib/next-param.ts`, `proxy.ts` | E `auth.spec.ts` (13), E `security.spec.ts` open redirect, U `auth.test.ts` | PASS |
| 6.2 Run lifecycle SUCCESS/PARTIAL/FAILED/SKIPPED, single RUNNING, abandoned recovery, empty results | `run-service.ts`, `cron-service.ts` | I `run-service.test.ts`, I `cron.test.ts` | PASS |
| 6.3 Daily automated run (cron, idempotent 30 min, window, cleanup 90 days) | `app/api/cron/daily/route.ts`, `cron-service.ts`, `vercel.json` | I `cron.test.ts` | PASS (provider for mode A not configured, see GAP-A) |
| 6.4 Owner-assisted ingest (token, helper) | `app/api/ingest/route.ts`, `providers/assisted-ingest.ts`; userscript helper not built | I `api.test.ts`; E `import.spec.ts` "assisted helper tab" | GAP-B (helper intentionally not built, D17) |
| 6.5 Manual import: paste/upload, preview, submit, summary; C-lite smart paste | `app/(app)/import/*`, `components/import/*`, `lib/import/*`, `domain/parse-page-text.ts`, `app/api/import/route.ts` | U `import.test.ts`, U `parse-page-text.test.ts`, E `import.spec.ts` (16), I `api.test.ts` import | PASS |
| 6.6 Run now (mode A): POST, poll, toast, refresh; 409 wrong mode; 503 not configured | `components/dashboard/useRunNow.ts`, `RunButton.tsx`, `app/api/run/route.ts` | E `dashboard.spec.ts` official API mode, E `resilience.spec.ts`, I `api.test.ts` run | PASS (against a mocked provider response, see GAP-A) |
| 6.7 Settings change effects (thresholds, window, scope, timezone, mode, password) | `components/settings/SettingsView.tsx`, `settings-service.ts` | I `settings.test.ts`, E `settings.spec.ts` (15) | PASS |
| 6.8 Re-screen | `run-service.ts` `rescreenAll`, `MaintenanceCard.tsx` | I `run-service.test.ts` (atomic across chunks), E `settings.spec.ts` | PASS |
| 6.9 Logout and session expiry | `app/api/auth/logout/route.ts`, `LogoutButton.tsx`, `lib/fetcher.ts` (401 -> login) | E `auth.spec.ts`, E `resilience.spec.ts` (401, cookie deleted mid-use), E `security.spec.ts` expired cookie | PASS |
| 5.2 Dashboard (header, run panel, stats, tabs, search, sort, grid, empty variants, mode actions) | `app/(app)/page.tsx`, `dashboard-content.tsx`, `components/dashboard/*` | E `dashboard.spec.ts` (20), C `dashboard.test.tsx` | PASS |
| 5.3 Match detail (hero, form, probabilities, source link, pager, no-longer-qualifies, 404) | `app/(app)/matches/[id]/page.tsx`, `components/match/*` | E `match-detail.spec.ts` (19), I `match-detail.test.ts` | PASS |
| 5.4 Runs (pagination 20, filters, SKIPPED toggle, detail dialog, live refresh) | `app/(app)/runs/*`, `components/runs/*` | E `runs.spec.ts` (7), I `runs-list.test.ts`, U `runs.test.ts` | PASS |
| 5.5 Import (tabs, token picker note, preview, submit) | see 6.5 | E `import.spec.ts` | PASS |
| 5.6 Settings (all cards, validation, unsaved guard) | see 6.7 | E `settings.spec.ts` | PASS |
| Health endpoint (minimal public shape) | `app/api/health/route.ts` | I `api.test.ts`, I `security.test.ts`, E `routing.spec.ts` | PASS |
| Scope items 1-13 (login, daily screening, rule, display fields, dashboard, detail, runs, settings, import, access modes, cron+stale, responsive UI, deploy docs) | as above | as above; deploy is manual (Step 17) | PASS except GAP-B, GAP-C, GAP-E |

## 5. State catalogue (ApplicationFlow section 9) and per-page gap hunt

Per-route/state matrix: `docs/STATE_AUDIT.md` (Step 14.1, all cells OK; the STEP13 cells for /import and /settings are now implemented and covered, see below).

| State | Where / implementation | Proven by | Status |
|---|---|---|---|
| Navigation loading bar | `components/states/RouteProgress.tsx` | C `states.test.tsx`, E `state-kit.spec.ts` | PASS |
| Page loading skeletons (every route incl. import/settings) | `app/(app)/**/loading.tsx`, `components/states/Skeletons.tsx` | E `routing.spec.ts` skeleton height parity, E `dashboard.spec.ts` CLS | PASS |
| Empty (no data per mode / none qualify / filtered out) | `components/states/EmptyState.tsx`, `dashboard-content.tsx` | E `dashboard.spec.ts` (3 variants) | PASS |
| Stale | `StaleBanner.tsx`, `FreshnessPill.tsx` | E `dashboard.spec.ts`, E `resilience.spec.ts`, C `freshness-pill.test.tsx` | PASS |
| Run in progress / Success / Partial | `RunStatusPanel.tsx`, `StatusChip.tsx` | E `dashboard.spec.ts`, E `runs.spec.ts` | PASS |
| Error + Retry (every route `error.tsx`, global-error) | `components/states/RouteError.tsx`, `ErrorState.tsx`, `app/global-error.tsx` | E `routing.spec.ts` forced error on every path, E `resilience.spec.ts` | PASS |
| Offline (banner, disabled actions with visible reason, back online) | `OfflineBanner.tsx`, `HelperText.tsx` | E `resilience.spec.ts`, E `import.spec.ts`, E `settings.spec.ts`, E `auth.spec.ts`, C `resilience.test.tsx` | PASS |
| Slow (3 s hint, 15 s timeout) | `SlowHint.tsx`, `lib/fetcher.ts` | E `resilience.spec.ts`, C `resilience.test.tsx`, U `resilience-fetcher.test.ts` | PASS |
| Session expired | `proxy.ts`, `lib/fetcher.ts` | E `resilience.spec.ts`, E `security.spec.ts` | PASS |
| Rate limited (login, Run now, ingest) | `rate-limit.ts`, `fetcher.ts` | E `resilience.spec.ts`, E `auth.spec.ts`, I `api.test.ts` | PASS |
| 404 / 500 branded | `app/not-found.tsx`, `(app)/not-found.tsx`, `NotFoundView.tsx` | E `routing.spec.ts`, E `match-detail.spec.ts` | PASS |
| Disabled with visible reason | `HelperText.tsx` | E `resilience.spec.ts`, `settings.spec.ts` | PASS |
| Console errors / page errors / hydration warnings on every page (production build) | n/a | E `console-audit.spec.ts` (added by this audit, 11 pages incl. 404 and /login) | __CONSOLE__ |
| Dead links / buttons | nav, pager, back link, source link | E `routing.spec.ts` every nav link, E `match-detail.spec.ts` pager/back/source link | PASS |

## 6. Findings, fixes and accepted gaps

__FINDINGS__

### Accepted gaps (known, recorded, not defects of the audited build)

| ID | Gap | Why accepted |
|---|---|---|
| GAP-A | Mode A (official API) provider is a stub: `/api/run` and cron answer `PROVIDER_NOT_CONFIGURED` | PrediGoal advertises no API; D17 permission outstanding. Mode C/C-lite is the delivered path. Cron and Run now are proven with a fake provider. |
| GAP-B | Owner-assisted userscript helper (Step 8.3) not built; `/api/ingest` is ready and tested | D17: not allowed without PrediGoal's written permission. |
| GAP-C | JS bundle budget: initial JS about 310-365 KB gzipped vs 200 KB target (react-dom and framer-motion dominate) | Accepted in Step 16; no functional impact. |
| GAP-D | `pnpm audit`: 1 high transitive, dev-only dependency | Not shipped to production. |
| GAP-E | Lighthouse not run; 15.3 real-device manual check not done; deployment (Step 17) manual | Need owner accounts/devices. |
| GAP-F | PrediGoal written permission (D17) outstanding | Client/owner action. |
| GAP-G | `docs/PROJECT_STATE.md` has a stale step table (rows "todo" for built steps, "Last updated" 2026-11-03) | Documentation drift; must be reconciled when the step branches' state is consolidated. |
