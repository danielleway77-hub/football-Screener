# TEST_CATALOG.md — exact tests to write, per master-guide step

> **How agents use this file:** each step's Master Prompt says "implement EVERY test listed under §<step id>". Create test files whose test names match (or clearly paraphrase) the items below, run them, and paste the evidence into `docs/TEST_LOG.md`. Add more tests if you find more risks — never fewer. Tests are written **first or together with** the code (domain/services: test-first).
> Conventions: **U** = unit (Vitest, node) · **C** = component (RTL, jsdom) · **I** = integration (Vitest + Neon *test* branch) · **E** = e2e (Playwright) · **A** = a11y (axe) · **M** = manual script · **MUT** = mutation check (make the deliberate change, confirm the named test FAILS, revert).
> Fixed clock for all time tests: `2026-11-03T12:00:00Z`. Owner timezone `Europe/London`. Golden fixture = "image #2 match": Sporting Cristal vs FC Cajamarca, form 80/7, win 76 · draw 16 · away 8, BTTS Yes 54, Over 70, predicted 3–1.

## 0.5.3 Tooling and env
- U: `env: throws a readable error listing every missing variable` · `env: rejects SESSION_SECRET shorter than 32 chars` · `env: server-only vars are not exported by the public env module`
- E (smoke): `home route responds` on the 4 viewport projects
- M: rename SESSION_SECRET in `.env.local` → `pnpm dev` fails with a clear message (restore) · add `import '@prisma/client'` in a component → `pnpm lint` fails (revert)
- MUT: remove a var from the zod schema → the env test for that var fails

## 1.2 Agent context load (no code)
- Verification instead of tests: the agent's 10-point summary must match the docs — rule strict `>75`/`<35` with either team strong · three modes + chosen plan (D16) · golden fixture values (76/16/8, BTTS 54/46, Over/Under 70/30, predicted 3–1) · view vs fetch window · MatchCard rows/heights and compact vs panel probability layouts · lime budget and "borders over shadows" · Home · Draw · Away order (D13).
- Evidence: paste the agent's summary into `docs/TEST_LOG.md` with your ✓/✗ per bullet. Any ✗ → correct the agent AND fix the doc if it was ambiguous.

## 2.1 Theme foundation
- E: `button md height is 44px / sm 36px / lg 52px` · `input height is 44px` · `body font-size is 16px` · `--primary computes to rgb(200,245,46)` · `style guide has no horizontal scroll at 360px` · `/style-guide returns 404 in production build`
- C: `Button loading keeps its width and sets aria-busy` · `Button disabled is not focusable via click`
- A: axe on `/style-guide` 0 serious/critical
- M: hover/Tab/disabled/loading each Button variant; open Select/Dropdown/Dialog/Sheet/Tooltip/Toast → all dark+lime, no white popups; emulate reduced-motion → shimmer stops
- Evidence: `git grep -nE "#[0-9A-Fa-f]{6}" src` output (only globals.css/icon.svg/metadata)

## 2.2 Contrast script
- U: `contrast ratio of black on white is 21` · `parses hex and rgba tokens` · `reports FAIL and exit code 1 when a pair is under threshold` · `required pairs list matches ThemeGuideline §2.6`
- M: set `--text-faint` to `#566761` → `pnpm contrast` exits 1 (revert)
- MUT: change a required threshold 4.5 → 3 → the "under threshold" test fails

## 2.3 Depth system
- E (`tests/ui/surfaces.spec.ts`): `card border is 1px and white alpha ≤ .14` · `card has no outer shadow at rest` · `dialog has a shadow` · `.glass has backdrop-filter` · `.num has tabular-nums` · `every border-radius is on the ladder` · `no element background is pure black or white`
- M: zoom 200% on a card corner (hairline continuous); scroll text under `.glass` sample (blurred, readable)
- MUT: set a card `border-radius: 13px` → the ladder test fails

## 3.1 Layout kit
- C: `Navbar marks the active link with aria-current` · `Navbar active pill follows route changes` · `MobileNav opens, traps focus, closes on Esc and on route change` · `ConfirmDialog shows pending state and an inline error on failure` · `ConfirmDialog never focuses the destructive button first` · `CopyButton shows Copied for 2s and falls back when clipboard is unavailable` · `Logo has accessible name`
- E: `navbar height is 64 (±1) at 1280 and 390` · `nav link height is 40` · `hamburger ≥ 44×44` · `mobile sheet rows are 56 tall` · `first Tab stop is the skip link` · `footer is at the viewport bottom on a short page` · `no horizontal overflow at 360`
- A: axe on shell demo
- M: keyboard-only through the shell; screen-reader names for icon buttons
- Evidence: `git grep -n "<nav" src` / `"<footer"` → only the shared components

## 3.2 State kit
- U: `fetcher retries GET on 503 twice then succeeds` · `fetcher does not retry POST` · `fetcher aborts at 15s with a timeout error` · `fetcher maps {error:{code,message,fieldErrors}} to a typed error` · `fetcher redirects to /login?next= on 401` · `fetcher throws OFFLINE without retry storm` · `formatKickoff renders owner timezone (Europe/London, DST day)` · `formatPct drops trailing .0` 
- C: `useOnlineStatus reacts to online/offline events` · `useSlowRequest fires after 3000ms (fake timers)` · `ErrorState retry button is disabled while pending and not double-fired` · `ErrorState never renders a stack trace` · `OfflineBanner shows Back online for 3s then hides`
- E: `skeleton and content swap has CLS < 0.01` · `offline banner appears and recovers` 
- M: DevTools Offline / Slow 3G on the playground
- MUT: change retry limit 2 → 20 → the retry-count test fails

## 3.3 Motion kit
- C: `CountUp renders the final value immediately with reduced motion` · `CountUp exposes the final value in aria-label` · `Stagger animates at most 8 children` · `Reveal triggers once` · `AnimatedBar uses the final width under reduced motion`
- E: `no hydration warnings in console on /style-guide`
- M: Performance trace at 4× CPU throttle on the motion section (no long frames)

## 3.4 Interaction kit
- C: `SpotlightCard attaches no pointer listeners on touch or reduced motion` · `SpotlightCard sets --mx/--my on pointermove` · `SegmentedControl supports ←/→/Home/End and aria-checked` · `StickyBar toggles isStuck when the sentinel leaves view` · `ScrollFade shows masks only on overflowing sides`
- E: `sticky bar becomes glass at the navbar line with no layout shift`
- M: move the pointer across 10 spotlight cards (no jank)

## 3.5 Brand kit
- U/C: `every illustration has viewBox 0 0 160 120` · `no illustration source contains a hex colour` · `illustration is aria-hidden unless a title is passed` · `Logo has accessible name "Screener"` · `icon files exist with expected dimensions` · `each illustration < 2 KB`
- E: `forced-colors emulation keeps illustration strokes visible`
- M: favicon visible at 16px in a tab; view illustrations at 160 and 80

## 4.1 Routes
- E: `every nav link navigates and shows the progress bar` · `unknown route shows the branded 404 with a link to /` · `forced error shows ErrorState with a working Retry` · `each page has exactly one h1` · `each page title matches the spec` · `/login has no nav and no footer` · `focus lands on #main after navigation` · `skeleton header height equals real header height (±2px)`
- M: slow a route by 1.5s to see skeleton then remove the delay

## 5.1 Database
- I: `unique (provider, providerMatchId) prevents duplicates` · `upsertMany is idempotent` · `createRunning returns the existing run when one is RUNNING` · `expireAbandoned marks runs older than 10 min FAILED` · `CHECK rejects lowThreshold >= highThreshold` · `CHECK rejects windowDays 3` · `cascade delete removes RunMatch rows` · `token hash is unique` · `rate-limit counter increments within a window` · `test guard: refuses to run against a non-test database`
- M: `pnpm db:studio` shows tables; `pnpm db:seed` twice → counts unchanged
- MUT: remove the partial unique index from the migration SQL in a scratch DB → the single-RUNNING test fails

## 6.1 Authentication
- U: `bcrypt verify accepts the right password and rejects the wrong one` · `session JWT round-trips and rejects tampering` · `expired JWT is rejected` · `sanitizeNext allows "/" and "/runs?x=1"` · `sanitizeNext rejects "//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", ""` · `rate limit blocks the 6th failed attempt within 15 min and recovers after the window`
- I: `requireSession logs out when sessionVersion changed`
- E: `logged-out visit redirects to /login?next=` · `wrong password shows the generic error` · `5 failures show the lockout message` · `correct login lands on the dashboard` · `logout clears the session` · `API call without cookie returns 401` · `login page redirects an authenticated user to /` · `cookie is HttpOnly and SameSite=Lax`
- Login UI (E at 390/1280): `input height 44, button height 52, toggle ≥ 44×44, no nav/footer, error associated via aria-describedby, focus in the password field on load`
- MUT: change `<` to `<=` in the rate-limit check → the boundary test fails; remove the sessionVersion comparison → the logout test fails

## 7.1 Domain (the most important tests in the project)
- U `evaluateMatch`: `qualifies when home 80 and away 7 (strong HOME)` · `qualifies when home 30 and away 82 (strong AWAY)` · `qualifies at 76/34` · `does not qualify at exactly 75/35` · `does not qualify at 44/56` · `does not qualify at 50/50` · `does not qualify when both above 75` · `does not qualify when both below 35` · `qualifies at 100/0` · `formGap is computed even when not qualifying` · `validateThresholds rejects low >= high, <0, >100, non-integers`
- U `normalize/schema`: `"80%" and "80 %" and 80 normalise to 80` · `bare 0.8 is rejected as ambiguous` · `0.8 accepted only with percentScale fraction` · `naive timestamp is rejected` · `value 120 is rejected` · `missing home form rejects the item` · `probabilities missing become undefined not 0` · `win/draw/win 76+16+8 accepted` · `34+33+34 (sum 101) accepted` · `70+30+30 (sum 130) rejected with the sum in the message` · `predictedScore 3–1 accepted, 3.5–1 and 25–0 rejected` · `duplicate ids in one payload: last wins, counted once` · `strings are trimmed and length-capped` · `non-https URLs rejected`
- U `window`: `tomorrow window in Europe/London on a normal day` · `windowDays 2 extends to the day after` · `DST spring-forward day (2026-03-29) has 23h and correct bounds` · `DST fall-back day (2026-10-25) has 25h and correct bounds` · `match at 23:30 UTC on a BST day belongs to the next London date` · `results identical under TZ=UTC and TZ=Asia/Karachi` · `dayRangeFor today/tomorrow/dayafter/upcoming` · `a match fetched yesterday as tomorrow falls under today now`
- Coverage: `src/server/domain` ≥ 95% lines and branches (threshold enforced)
- MUT: `>` → `>=` in evaluateMatch → the "exactly 75/35" test fails · remove the sum check → the 130 test fails · replace tz-aware date math with UTC → the BST test fails

## 8.1 Run service
- I: `processBatch is idempotent (same payload twice → same Match count, lastRunId updated)` · `PARTIAL when one item is invalid and others stored, with item reasons in details` · `FAILED and nothing stored when every item is invalid` · `form-scope mismatch item rejected with reason` · `missing probabilities stored as null` · `predicted score stored and updated` · `fetchedAt is set by the server` · `DB error mid-transaction rolls back and prior data is intact` · `two parallel processBatch calls: second returns the existing run` · `abandoned RUNNING run is expired at the start of a new run` · `rescreenAll changes qualifies when thresholds change to 70/40 and is atomic` · `cleanup removes only matches older than 90 days after kickoff and old attempts` · `500-match batch completes under 2s locally`
- U (fake provider): `pull provider returning zero fixtures gives SUCCESS with scanned 0 and a note`
- MUT: remove the transaction wrapper → the rollback test fails

## 8.2 API endpoints
- I (route handlers): `ingest rejects missing, malformed, wrong and revoked tokens with 401` · `ingest 429 on the 31st request in an hour with Retry-After` · `ingest 413 for a body over 1 MB (also when content-length is missing)` · `ingest 422 for invalid payload with reasons` · `ingest 422 for an empty matches array` · `ingest success returns runId/scanned/qualified/failed` · `CORS: allowed origin echoed, disallowed origin gets no ACAO, preflight exact, no origin + valid token allowed` · `/api/import requires a session` · `/api/run returns 409 when the mode cannot pull and 202 with existing runId when already running` · `/api/runs/[id] 404/200 and abandoned expiry on read` · `/api/health anonymous returns only ok and db; with session adds lastRun` · `token create returns plaintext once and stores only the hash` · `token revoke is idempotent` · `responses never echo secrets` 
- M: PowerShell `Invoke-RestMethod` ingest with `tests/fixtures/matches.json` → counts; revoked token → 401
- MUT: compare tokens with `===` on plaintext instead of hash lookup → the "hash only" test fails

## 8.3 Userscript helper (only if built)
- U: `mapping converts the saved sanitized PrediGoal fixture to RawMatchInput` · `golden fixture: 80/7, 76/16/8, BTTS 54, Over 70, predicted 3–1` · `kickoff keeps timezone` · `a layout change (missing field) yields a precise error naming the field`
- M: live run on your own account: progress panel → dashboard shows the match; compare 3 qualifying + 3 non-qualifying with PrediGoal; Network tab shows ≥1 s spacing and only our /api/ingest POSTs; revoke token → clear message
- Evidence: HELPER_NOTES.md lists exactly what is read and sent

## 9.1 Cron
- I: `cron rejects missing and wrong secret` · `cron is idempotent within 30 min` · `pull mode success with a fake provider` · `provider failure → FAILED run, data intact` · `push mode → SKIPPED run, no data change` · `cleanup keeps upcoming matches` · `abandoned run expired first`
- M: `pnpm run:daily` against `pnpm dev`

## 10.1 Match components
- C: `FormBar shows strong, average, poor states with icon + label` · `FormBar tick marks sit at low and high` · `FormBar aria-label includes team, percent and rule` · `FormBadges letters and aria-labels` · `ProbabilityGrid highlights the highest 1X2 only when all three present and no tie` · `PairTile makes the larger value lime and neither on a tie` · `missing values show Unavailable not 0` · `PredictedScore hidden when absent` · `MatchCard is a single link and contains no other interactive element` · `long names truncate with title` · `golden fixture renders 76/16/8, 54/46, 70/30, 3–1`
- E (style guide): `card height within ±8px of MATCH_CARD_MIN_HEIGHT at 360/768/1280/1920` · `skeleton height equals card height` · `bar track 8px, chip 28px, tile 64px` · `card never overflows its container`
- A: axe on card states
- MUT: swap the strength thresholds in FormBar → the state test fails

## 10.2 Dashboard
- I: `query returns only qualifying upcoming matches` · `tabs: today/tomorrow/dayafter in owner timezone` · `search filters by league (case-insensitive)` · `sort by kickoff and by form gap` · `past matches hidden` · `limit 200 enforced`
- E: `golden: Sporting Cristal 80/7 visible, Atlético 44/56 absent` · `filters update the URL and survive reload/back` · `bento hero count equals number of qualifying matches` · `layout: hero 6/12 at 1280, hero full width at 390, grid columns 1/2/3/4 at 390/900/1280/1920` · `empty variants: no data, none qualify, filtered out` · `stale banner at 30h` · `Run now polls and stops on terminal/unmount` (mode A) · `Update data links to /import` (B/C) · `offline disables actions with visible reason` · `500 shows ErrorState with Retry and keeps header` · `skeleton→content CLS < 0.01`
- A: axe on each state
- M: phone check of the thumb-reachable primary action
- MUT: remove the `kickoffAt >= now` filter → "past matches hidden" fails

## 10.3 Sticky filter bar
- E: `bar docks under the navbar and becomes glass` · `height unchanged when stuck (CLS < 0.01)` · `offline banner shifts the bar by 44px` · `mobile search expands, syncs q, Esc closes` · `tabs arrow-key navigation` · `scroll restored after Back from detail` · `reduced motion removes transitions`

## 10.4 Day groups and freshness pill
- U/I: `groups by owner-timezone date incl. DST and just-after-midnight` · `sort applies within groups` 
- C: `FreshnessPill states: fresh, stale, never, running` · `relative text updates with fake timers and pauses when hidden`
- E: `Upcoming tab shows group headers; single-day tabs do not` · `pill in navbar at 1280, in the sheet at 390; click opens /runs` · `initial pill value is server-rendered (no flash)`

## 11.1 Match detail
- E: `deep link and refresh work` · `invalid id gives branded 404` · `no-longer-qualifies note when thresholds change` · `pager disabled at the ends with visible text` · `external link has rel noopener noreferrer and target _blank` · `hero shows one h2 per team` · `explanation sentence contains both teams and both percentages` · `layout: form card ≈ 7/12 and probability card ≈ 5/12 at 1280` · `ProbabilityPanel shows predicted score, Home/Draw/Away bars, BTTS Yes/No, Over/Under with golden values`
- U/C: `ProbabilityPanel highest bar lime and others neutral; null → Unavailable; no predicted score hides the hero`
- XSS: `team name with <script> renders as text`

## 11.2 FormDuel
- C: `marker positions equal pct (clamped 2–98%)` · `overlap offsets the lower marker below the track` · `75/35 bracket neutral; 76/34 bracket lime` · `aria-label contains both teams, both percentages, gap and qualifies state` · `reduced motion shows final state` 
- E: `no horizontal scroll at 360`

## 12.1 Runs
- I: `pagination 20 per page capped server-side` 
- E: `status filter and show-skipped toggle` · `row Enter opens the dialog; Esc closes and focus returns to the row` · `mobile renders cards only at 390 (no table) with Details ≥ 44×44` · `RUNNING row updates to SUCCESS without reload and polling stops` · `table row height 56, header 44 at 1280` · `long error wraps`

## 13.1 Settings
- U: `settings schema rejects low >= high, windowDays 3, bad timezone, staleAfterHrs 0` 
- I: `PUT /api/settings saves; re-screen changes qualifies at 70/40` · `token create shows plaintext once; list never contains it` · `revoked token fails /api/ingest` · `max 5 active tokens` · `password change: wrong current rejected, success updates Credential, bumps sessionVersion, other session logged out, current kept`
- E: `dual slider keeps low < high; numeric inputs inputmode numeric` · `sticky save bar at 390 with safe-area padding` · `keyboard-only completion` · `offline disables Save with visible reason` · `section nav highlights on scroll at 1280`
- MUT: remove the sessionVersion bump → the other-session test fails

## 13.2 Import
- U: `CSV parser handles BOM, quotes, ; delimiter, % signs, comma decimals` · `ambiguous 0.8 and naive timestamps rejected with row numbers` · `preview counts valid/invalid/qualifying with current thresholds`
- E: `paste sample → preview → submit → dashboard shows golden match` · `2 MB file rejected with friendly message` · `double submit creates one run` · `invalid rows listed first` · `table becomes cards at 390`

## 13.2 (addendum) Smart paste / C-lite parser
- U (`parse-page-text`): `parses the golden image #2 text: teams, 76/16/8, BTTS 54/46, Over/Under 70/30, predicted 3–1` · `parses the Recent Form block: Atlético 44 / Bayern 56` · `tolerates extra whitespace, line breaks and the "AI" badges` · `missing form % for either team → match marked blocked (never guessed)` · `unknown layout returns a precise "could not find <field>" list` · `several matches pasted back-to-back are split correctly` · `percent values with and without % sign` · `no network access in the parser`
- E: `paste the golden text → preview shows 80/7 qualifies → import → dashboard shows it` · `inline correction of a parsed value is reflected in the import` · `kickoff date picker required when not parsed` · `warning text "you still open the matches yourself" is visible`
- MUT: make the parser fall back to 0 for a missing form % → the "blocked, never guessed" test fails

## 14.1 Resilience
- E: for each route: `offline`, `slow (>3s hint)`, `timeout (>15s) with Retry`, `500 ErrorState`, `401 redirect with next`, `429 login lockout`, `stale banner`, `PARTIAL display`
- Evidence: `docs/STATE_AUDIT.md` with zero "missing"

## 15.1 Polish / 15.4 Delight
- E: `Lighthouse mobile ≥ 90 on /login and authenticated dashboard (production build)` · `CLS < 0.05` · `reduced motion renders static finals` · `getAnimations() on the dashboard only animates transform/opacity (and bar width)` · `login timeline total < 1.3s`
- M: 4× CPU throttle scroll; spotlight on desktop only; morph fallback in Firefox/Safari

## 15.2 Design critique and elevation
- E: re-run `pnpm test:ui` and all e2e after the changes (no regression) · `bundle growth ≤ 5 KB gz per screen` · `CLS unchanged`
- Evidence: before/after screenshot pairs per screen in `docs/reference/ui-review/15.2/`; rubric scores ≥ 19/20; the "3-second test" result noted (someone correctly names the qualifying matches and numbers within 3 s)

## 15.5 Sleek tests
- E: the 10 items of `tests/ui/sleek.spec.ts` + baselines (see Step 15.5); **negative proof:** introduce a 13px radius and a large lime block → the radius and lime-budget tests fail (revert)

## 15.6 Micro-details and contrast modes
- E: `forced-colors: active — focusable elements show an outline and boundaries do not rely on box-shadow alone` · `prefers-contrast: more — hairline alpha ≥ .30` · `reduced-transparency — navbar is solid` · `200% zoom: no clipping/horizontal scroll` · `2560×1440: 4 cards per row, nothing wider than 1680 except backgrounds`
- Evidence: `docs/reference/ui-review/15.6/microdetails.md` (30 rows)

## 19.1 Handover assets
- Verification: `README.md` commands work from a clean clone in a fresh folder (install → env → migrate → seed → dev → test) · `git grep -n -i "password\|secret\|token" docs README.md` shows only generic words · `CLIENT_GUIDE.md` read by a non-technical person who then gets results in < 5 minutes · every screenshot in the guide matches the current UI
- Evidence: record the clean-clone run output and the reader's feedback in `docs/TEST_LOG.md`

## 16.1 Hardening
- E/A: `axe 0 serious/critical on every route (normal, forced-colors, contrast more)` 
- Security (E/I): `every route and API without auth → redirect/401` · `tampered and expired JWT rejected` · `wrong Origin on session POST rejected` · `oversized body 413` · `<script> in team name stored and rendered inert` · `open-redirect next values blocked` · `CSP header present and app still renders` · `/style-guide 404 in production`
- Evidence: `pnpm audit`, bundle analyzer summary, EXPLAIN of dashboard query using the index
