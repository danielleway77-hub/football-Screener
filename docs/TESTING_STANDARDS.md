# TESTING_STANDARDS.md (v2)

## 1. Tools
Vitest (unit/integration) · React Testing Library + `@testing-library/user-event` · MSW (network mocking) · Playwright (e2e, responsive, state emulation) · `@axe-core/playwright` (a11y) · Lighthouse (manual/CI) · Neon `test` branch for DB tests.

## 2. Test pyramid and coverage gates
| Layer | What | Gate |
|---|---|---|
| Unit | domain (screening, window, normalize, schema), auth utils, formatters | `server/domain` ≥ 95% lines/branches |
| Integration | repositories + services against DB (`DATABASE_URL_TEST`), API route handlers | services ≥ 85% |
| Component | components with logic/states (FormBar, ProbabilityGrid, MatchCard, filters, forms) | each has tests for null/extreme/empty |
| E2E | login, dashboard filters, detail, import, settings, run-now, logout, state emulation | each flow in `ApplicationFlow.md` §6 |
| A11y | axe on every route/state at mobile + desktop | 0 serious/critical |
| Performance | Lighthouse mobile on `/login` + dashboard | ≥ 90 each category |
Run order before commit: `pnpm lint && pnpm typecheck && pnpm test`; before merging a step also `pnpm e2e`.

### 2b. Test evidence, catalog and quality gates
- **`TEST_CATALOG.md`** lists the exact tests each step must contain (unit, component, integration, e2e, a11y, manual script, mutation check). Agents implement every item and may add more.
- **`TEST_LOG.md`** receives one evidence block per step (commands + real results, catalog completion, mutation checks, responsive/a11y results, hunt summary). A step is "done" only when its block exists and is green.
- **Mutation check (mandatory for domain, services, auth, API, run pipeline):** make one deliberate small defect (flip a comparison, remove a transaction or guard, skip a validation), run the tests, confirm at least one test fails *for that reason*, revert. If nothing fails, the tests are too weak — add the missing test.
- **Test-first rule:** domain, services, auth and API tests are written before the implementation (red → green). UI layout assertions are written with the component.
- **No-weakening rule:** never lower coverage thresholds, loosen tolerances (CLS, pixel diff, size ±), skip or delete a failing test to pass; fix the cause or ask.
- **Determinism:** frozen clock `2026-11-03T12:00:00Z`, owner TZ `Europe/London`, seeded fixtures (including the golden "image #2" match), no real network, no `waitForTimeout`.
- **Flaky = failing:** a test that passes on retry is a defect; allow `retries: 1` only in CI and log it.
- **Layer expectations:** domain ≥ 95% · services ≥ 85% · every route handler has auth/validation/error-path tests · every UI screen has layout (boundingBox), state, keyboard, and axe checks.
- **Commands cheat-sheet:** `pnpm lint` · `pnpm typecheck` · `pnpm test` (unit/integration) · `pnpm test:cov` · `pnpm test:tz` · `pnpm e2e` (Playwright, 4 viewport projects) · `pnpm test:ui` (sleek + baselines, Step 15.5) · `pnpm contrast` · `pnpm build && pnpm start` for production-like runs.

## 3. Viewport matrix (every UI step)
| Name | Size | Why |
|---|---|---|
| Small phone | 360×800 | minimum design width |
| Phone | 390×844 | common iPhone |
| Tablet portrait | 768×1024 | nav breakpoint |
| Tablet landscape | 1024×768 | |
| Laptop | 1280×800 | grid 3-col |
| Desktop | 1536×864 | |
| Full HD | 1920×1080 | 3xl layout |
| QHD | 2560×1440 | max-width/centering |
Check: no horizontal scroll, no clipped/overlapping text, targets ≥ 44px, nav works, cards reflow, dialogs → bottom sheets < 640, tables → cards < 768, long names truncate, sticky bars don't cover content (safe-area).

### 3a. Sleek acceptance suite (Step 15.5, then every release)
`pnpm test:ui` runs `tests/ui/sleek.spec.ts` (UI_BLUEPRINT §28): lime budget < 3%, radius ladder, no pure #000/#FFF, no resting outer shadows on cards, tabular numerals, hairline consistency, no text < 12px, touch targets ≥ 44, CLS < 0.05, plus `toHaveScreenshot()` baselines for key screens at 390 and 1280 (maxDiffPixelRatio 0.002, animations disabled, frozen clock/fonts). Update baselines only after a deliberate design change (`pnpm e2e --update-snapshots`) and review the diff images.

### 3b. UI visual review (every UI step)
Capture Playwright screenshots of each affected screen/state at the 8 viewports into `docs/reference/ui-review/<step>/`, compare with the wireframe in `UI_BLUEPRINT.md`, and score with its §17 rubric (target ≥ 18/20, no zeros). Use realistic fixtures (long names, 0/100, nulls, 1X2 tie, away-strong). Optional: Playwright `toHaveScreenshot()` baselines for the style guide and key screens (threshold 0.2%) to catch accidental visual regressions; update baselines only after a deliberate design change.

## 4. State matrix (every async view)
loading skeleton · section skeleton · empty (no data / none qualify / filtered) · error + retry · success feedback · partial · stale · disabled · slow (throttle Slow 3G / route delay > 3s) · timeout (> 15s) · offline (`context.setOffline(true)`) · session expired (401) · rate-limited (429) · 404.

## 5. Fixtures (`tests/fixtures/matches.json`)
| Case | Home/Away form | Expected |
|---|---|---|
| Sporting Cristal vs FC Cajamarca (client example) | 80 / 7 | qualifies, strong HOME |
| Away-strong | 30 / 82 | qualifies, strong AWAY |
| Just inside | 76 / 34 | qualifies |
| Boundary | 75 / 35 | **no** |
| Atlético vs Bayern (client screenshot) | 44 / 56 | no |
| Both high | 80 / 90 | no |
| Both low | 10 / 20 | no |
| Extreme | 100 / 0 | qualifies |
| Missing probabilities | 80 / 7, no probs | qualifies, probs null → "Unavailable" |
| **Client image #2 values (golden fixture)** | Sporting Cristal 80 / FC Cajamarca 7; win 76 · draw 16 · away 8; BTTS yes 54 (No 46 derived); Over 70 (Under 30 derived); predicted score 3–1 | stored exactly; UI shows 76/16/8, 54/46, 70/30, 3–1; highest 1X2 = home; larger of pairs = Yes, Over |
| 1X2 does not add up | home 70 · draw 30 · away 30 (sum 130) | rejected: "win/draw/win probabilities add up to 130, expected about 100" |
| 1X2 rounding | 34 · 33 · 34 (sum 101) | accepted |
| Predicted score invalid | 3.5 – 1 or 25 – 0 | item rejected (integers 0–20) |
| Pair tie | BTTS 50 / 50 | neither value lime |
| Missing one form | – / 20 | rejected (invalid) |
| Out of range | 120 / 5 | rejected |
| Percent strings | "80%" / "7 %" | normalised → qualifies |
| Bare fraction | `0.8` / `0.07` without declared scale | rejected (ambiguous) |
| Naive timestamp | `"2026-11-04T19:45:00"` (no Z/offset) | rejected |
| Wrong form scope | item `overall` while setting is `league` | rejected, reason "form scope mismatch" |
| Empty payload | `matches: []` | 422 |
| All items invalid | every item malformed | run FAILED, nothing stored |
| Stuck run | RUNNING row older than 10 min | auto-FAILED on next start; new run succeeds |
| Concurrent triggers | two simultaneous `POST /api/run` | one run executes, both get same runId |
| Stale payload re-sent | same batch twice | no duplicates; counts stable |
| Duplicates in one payload | same id twice | last wins, counted once |
| Malformed | wrong types | PARTIAL with reasons |
| DST days | kickoff on last Sunday of Mar/Oct (Europe/London) | correct window |
Also store sanitized PrediGoal HTML/JSON samples in `tests/fixtures/predigoal/` for the provider mapping test (no personal data, no tokens).

## 5b. Test infrastructure rules
- **Database isolation:** integration/e2e use `DATABASE_URL_TEST` (Neon branch `test`), never dev/prod. Each suite resets with `TRUNCATE … RESTART IDENTITY CASCADE` in `beforeAll`/`beforeEach`, then seeds from fixtures. Tests must be order-independent and parallel-safe (Vitest `--pool=forks`, one DB-using worker, or a schema-per-worker).
- **Time:** inject a clock (`now` parameter) in domain/services; never rely on the real date in tests. Use fixed dates around DST (e.g. 2026-03-29 and 2026-10-25 for Europe/London).
- **Auth in e2e:** a Playwright `globalSetup` logs in once via `POST /api/auth/login` using a test-only password hash env, saves `storageState`, and reuses it. Login-flow tests run without storage state.
- **E2E server:** run against `pnpm build && pnpm start` in CI/final audits (not `next dev`) so results match production (dev mode inflates warnings and timings).
- **Network emulation:** Playwright `context.setOffline`, `route.fulfill` (500/401/429), delayed routes (> 3s, > 15s). MSW only for unit/component tests.
- **Flakiness policy:** no `waitForTimeout` — wait on locators/network; a test that fails once then passes is a bug to fix, not retry (allow `retries: 1` only in CI and log it).
- **CI (optional but recommended):** GitHub Actions on PR: install → lint → typecheck → unit/integration (Neon test branch secret) → build → Playwright (Chromium; WebKit/Firefox nightly or at final audit). Never print env secrets in logs.
- **Cross-browser:** final audit runs Chromium + WebKit (Safari proxy) + Firefox smoke on login/dashboard/settings.
- **Security tests:** unauthenticated access to every route/API → 401/redirect; tampered JWT; expired JWT; revoked token; wrong `Origin`; oversized body; SQL-ish/HTML payload strings stored and rendered inert; open-redirect `next` values (`//evil.com`, `https://evil.com`, `/\evil.com`).

## 6. Per-step test procedure
1. **Automated:** lint, typecheck, unit/integration, component, e2e relevant to the step.
2. **Manual functional checklist** (from the guide section).
3. **Responsive matrix** (§3) for any UI change.
4. **State matrix** (§4) for any async view.
5. **A11y:** keyboard-only pass (Tab/Shift+Tab/Enter/Space/Esc/arrow keys), axe scan, 200% zoom, reduced-motion.
6. **Bug & Gap Hunt** (guide Appendix A) → fix → re-run 1–5.
7. Update `PROJECT_STATE.md` (status, results, known issues).

## 7. How to emulate conditions
- Offline: DevTools → Network → Offline (Playwright `context.setOffline`). Slow: "Slow 3G" preset (Playwright route delay). 500 errors: MSW handler or route fulfill. Expired session: delete cookie / tamper JWT. DB down: wrong `DATABASE_URL`. Reduced motion: DevTools → Rendering → Emulate `prefers-reduced-motion`. CPU throttle 4×/6× for animation smoothness. Timezone: run with `TZ=UTC` and `TZ=Asia/Karachi` (server ≠ owner TZ).

## 8. Bug severity and policy
P0 wrong data/security/crash/data loss · P1 broken flow/missing required state · P2 UI/responsive/a11y defect · P3 polish. **No open P0/P1 at delivery; P2 fixed unless client-approved.** Every fix adds a regression test.

## 9. Definition of "step passed"
Automated green · manual checklist done · matrices done · bug hunt = 0 open P0–P2 · docs updated · committed on the step branch.

## 10. Final acceptance tests (production, real data)
Compare 10 sampled matches with PrediGoal (form + 5 probabilities identical) · 3 days of qualifying list vs owner's manual result · owner completes the daily flow on her phone in < 2 min · cron/ingest run visible in `/runs` · stale banner appears after 27h without data (simulate) · logout/login works on her devices.
