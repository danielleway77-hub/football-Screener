# STATE_AUDIT.md — route x state coverage (Step 14.1)

Legend: OK = implemented and covered by the named test; N/A = state cannot occur; STEP13 = the screen/mutation is built by Step 13 (separate branch) and must be re-audited when merged (no cell is "missing" for code that exists today).
Tests: `R` = `tests/e2e/resilience.spec.ts`, `RC` = `tests/components/resilience.test.tsx`, `RF` = `tests/unit/resilience-fetcher.test.ts`, `D` = `dashboard.spec.ts`, `RN` = `runs.spec.ts`, `SK` = `state-kit.spec.ts`.

## Routes

| State | /login | / | /matches/[id] | /runs | /import | /settings |
|---|---|---|---|---|---|---|
| Loading skeleton | N/A (static) | OK `(app)/loading.tsx` | OK `[id]/loading.tsx` | OK `runs/loading.tsx` | STEP13 (loading.tsx exists) | STEP13 (loading.tsx exists) |
| Empty variants | N/A | OK 3 variants (D) | N/A (404 below) | OK "No runs yet" (RN) | STEP13 | STEP13 |
| Error + retry | inline field error (auth.spec) | OK ResultsError + route error.tsx (D, R `?__error`) | OK `[id]/error.tsx` | OK RunsError + error.tsx (RN, R) | STEP13 (error.tsx exists) | STEP13 (error.tsx exists) |
| Offline | OK Sign in disabled + HelperText (R) | OK banner, Run now disabled + HelperText (R, RC, D) | OK banner (R) | OK banner, list stays (R) | STEP13 | STEP13 |
| Back online + Refresh (GET only) | N/A | OK (R, RC) | OK (R) | OK (R) | – | – |
| Slow >3 s | OK SlowHint under button (R) | OK SlowHint under Run now (R, RC) | N/A (server render, skeleton) | N/A (server render, skeleton) | STEP13 | STEP13 |
| Timeout >15 s | N/A (browser default) | OK message + retry works (R) | N/A | N/A (polling retries on next tick) | STEP13 | STEP13 |
| Stale | N/A | OK banner + pill (R, D) | OK stale flag | OK | – | – |
| PARTIAL | N/A | OK panel counts + warning chip (R, D) | N/A | OK chip + row (RN) | – | – |
| 401 mid-session | N/A | OK -> `/login?next=` and back (R) | OK via proxy (R cookie delete) | OK `/runs?page=1` returns after login (R) | STEP13 | STEP13 |
| 429 | OK wait time in minutes + form disabled (R) | OK Run now shows wait time (R, RF) | N/A | N/A | STEP13 | STEP13 |
| 500 | OK "Couldn't reach the server" (R keeps typed password) | OK helper alert + 8 s toast, no stack (R) | OK error.tsx | OK error.tsx (R) | STEP13 | STEP13 |
| 404 | N/A | N/A | OK `(app)/not-found.tsx` (R) | N/A | – | – |

## Client mutations

| Mutation | Pending (disabled + spinner) | Offline (disabled + visible reason) | Slow hint | Errors (401/429/500, no stack) | No double fire |
|---|---|---|---|---|---|
| Login | OK | OK HelperText | OK | OK | OK (form disabled while submitting) |
| Run now | OK | OK HelperText | OK | OK (toast 8 s) | OK in-flight ref + disabled (RC, R `dblclick` = 1 request) |
| Logout | OK | OK disabled + tooltip/title | – (instant) | OK toast 8 s | OK busy ref |
| Import | STEP13 | STEP13 | STEP13 | STEP13 | STEP13 |
| Settings save / token create+revoke / password change / re-screen | STEP13 | STEP13 | STEP13 | STEP13 | STEP13 |

Rules confirmed: all client requests go through `lib/fetcher.ts` except login/logout (a 401 on login means "wrong password"); only GETs retry (RF "no replay"); no mutation is replayed after reconnecting (R); the global `OfflineBanner` shows "Back online." (3 s) with a Refresh button that only re-reads the current view; client islands (RunStatusPanel, RunsList) are wrapped in `AppErrorBoundary` (logs, no stack in the UI).
