# ApplicationFlow.md — Football Match Screener (v2)

> Primary behavioural reference for every agent. Read before implementing. If code and this file disagree, stop and report the conflict instead of guessing. Visuals: `ThemeGuideline.md`. Structure: `ARCHITECTURE.md`. Requirements: `PROJECT_SCOPE.md`.

## 1. Purpose in one paragraph
A private, single-user web dashboard. Once a day it receives fixtures 1–2 days ahead from PrediGoal (through an authorized access path), keeps only matches where **one team's recent-form % is > 75 and the other's is < 35**, and shows for each: both form values and the probabilities **home win, draw, away win, BTTS, over 2.5 goals**. It replaces hours of opening matches one by one.

## 2. Actors
| Actor | Needs | Touches |
|---|---|---|
| **Owner (Danielle)** | open → see qualifying matches → read numbers; occasionally change thresholds; give data in modes B/C | Dashboard, Match detail, Import, Settings, Runs |
| **System** | fetch/receive → screen → store → expose status | Cron, ingest, run service |
| **Developer** | deploy, debug, rotate secrets | Runs, `/api/health`, runbook |

## 3. Data-access modes (one pipeline, three doors)
| Mode | Key | Data arrives via | Unattended | `canPull` |
|---|---|---|---|---|
| A. Official/authorized API or export | `official_api` | Cron/Run-now calls provider | Yes | true |
| B. Owner-assisted ingest | `assisted_ingest` | Owner's own logged-in browser runs a helper → `POST /api/ingest` (token) | No (one click/day) | false |
| C. Manual import | `manual_import` | Paste/upload JSON/CSV in `/import` **or "smart paste" of text the owner copies from a match page (C-lite)** | No | false |
> **Compliance note (D17/D18):** PrediGoal's Terms §7 prohibit scraping/reverse engineering and "automated systems without permission". Modes **A and B require PrediGoal's written permission**; without it only C / C-lite is delivered (the owner opens the pages herself; the tool saves typing and does the screening/formatting). Never describe C-lite to the client as "fully automatic".
Setting `accessMode` decides which UI affordances appear ("Run now" vs "Update data") and what cron does. The screening engine never knows which mode produced the data.

## 4. Sitemap and navigation
```
(unauthenticated)  /login ──success──▶ next || /
(authenticated, shared AppShell: Navbar · main · Footer)
  /                  Dashboard
  /matches/[id]      Match detail           ◀── card click / deep link
  /runs              Run history
  /import            Data intake (helper instructions + paste/upload)
  /settings          Screening, schedule, access mode, tokens, security
  logout ─▶ /login
(system)  /api/cron/daily · /api/ingest · /api/run · /api/runs/[id] · /api/health · /api/auth/*
(fallbacks) not-found · error boundary · global-error
```
Rules: one `AppShell`; nav links = Dashboard, Runs, Import, Settings, Logout. Back button always works; filters live in the URL.

### 4.1 Dependency map (what needs what)
`Settings → (thresholds, window, scope, tz, mode) → Screening → Match.qualifies → Dashboard/Detail`
`Run (any trigger) → Matches upserted → Dashboard stats/Stale logic`
`Ingest token → /api/ingest → Run`
`Session → every authenticated page and /api/run|tokens|settings`
`Chosen access mode → Dashboard buttons, Import tab visibility, Cron behaviour, empty-state copy`

## 5. Screen specifications
### 5.1 /login
- Content: Logo, "Sign in" h1, password field (show/hide toggle), submit, small privacy note.
- Actions: submit → `POST /api/auth/login`.
- States: idle · submitting (button spinner, field disabled) · error ("Incorrect password") with shake · locked (429: "Too many attempts. Try again in N minutes.") · offline (banner + disabled submit) · already-authenticated → redirect `/`.
- Rules: `next` accepted only if it starts with `/` and not `//`; otherwise `/`.

### 5.2 / Dashboard
| Region | Content | Data | States |
|---|---|---|---|
| Header | h1 "Qualifying matches", sub: "Form above 75% vs below 35%" (live from settings), window label ("Tomorrow & day after") | Setting | – |
| RunStatusPanel | last successful run time (owner TZ + relative), status chip, scanned/qualified, primary action | latest run | none yet · running · success · partial · failed · stale |
| Stats strip | Scanned · Qualifying · Last update | latest successful run | skeleton · loaded |
| Filters | Day tabs **Upcoming (default) · Today · Tomorrow · Day after** (Day after hidden when `windowDays=1`), league search, sort (Kickoff ↑ default, Biggest form gap ↓) | URL params `day(upcoming\|today\|tomorrow\|dayafter), q, sort` (zod-validated; invalid → defaults) | – |
| Grid | MatchCards of qualifying matches in selected scope | match service | skeleton · empty variants · error |
- **Primary action by mode:** A → "Run now" (POST `/api/run`, then poll); B/C → "Update data" (goes to `/import`).
- **Empty variants:** (1) *No data yet* → onboarding card specific to mode; (2) *Data present, none qualify* → "No matches met 75% / 35%. N scanned at HH:MM." + link to Settings; (3) *Filter excludes all* → "Clear filters".
- **Stale:** `now - lastSuccess.finishedAt > staleAfterHrs` → warning banner + action; cards still shown (clearly dated).
- **View semantics (important):** the *window* (1–2 days) controls what is **fetched/screened** at run time. The *dashboard view* shows every stored qualifying match whose `kickoffAt >= now` (matches already kicked off are hidden from the dashboard but stay in history/detail). Tabs are computed from the **current date in the owner's timezone** at view time (so a match fetched yesterday as "tomorrow" correctly appears under "Today" now). Tab dates use the owner's timezone, never UTC.
- **Stats strip definitions:** *Scanned* and *Qualifying* come from the latest SUCCESS/PARTIAL run (the data batch), *Showing* = current filtered count. Don't mix them.

### 5.3 /matches/[id]
Hero (teams, logos, league, kickoff, QUALIFIES chip, "Strong: <team>"), FormBars with threshold ticks, form scope label, W/D/L badges if provider supplies them, ProbabilityGrid, confidence if supplied, freshness ("Fetched …"), "Open on PrediGoal" (only if `sourceUrl`), prev/next qualifying match. If the match no longer qualifies (settings changed): show amber note "No longer qualifies under current thresholds". Unknown id → `notFound()`.

### 5.4 /runs
Paginated (20/page) list: started, trigger (CRON/MANUAL/INGEST/IMPORT), mode, status chip, scanned, qualified, failed, duration. Row opens detail dialog: error text + failed items. Auto-refresh every 3s only while a RUNNING run is visible. `SKIPPED` runs hidden by default (toggle "Show skipped").

### 5.5 /import
Tab **Assisted helper** (only meaningful in mode B): token picker, install instructions, last ingest time. Tab **Paste / upload**: input → client-side zod preview (valid / invalid rows, qualifying preview count) → Submit → result summary. Always reachable (it is also the fallback if the helper breaks).

### 5.6 /settings
Cards: Screening (high, low, windowDays 1|2, formScope league|overall), Schedule & timezone, Data access (mode + stale hours), Ingest tokens, Security (change password), Maintenance (Re-screen existing data). Validation: integers 0–100, `low < high`, `windowDays ∈ {1,2}`, timezone from IANA list. Save is explicit; unsaved-change guard.

## 6. Core workflows
### 6.1 Login (see §5.1)
Unauthenticated request to protected route → 302 `/login?next=<path>` → success sets signed httpOnly cookie → redirect. 5 failed attempts / IP / 15 min → 429.

### 6.2 Run lifecycle (state machine)
```
            create
              │
          RUNNING ──(validation of all items ok)──▶ SUCCESS
              │ └─(some items invalid, others stored)──▶ PARTIAL
              └─(provider/DB failure, OR every item invalid → nothing stored)──▶ FAILED
(cron in non-pull mode) ─▶ SKIPPED (stale check only)
```
- Only **one RUNNING run at a time** (enforced by a DB partial unique index, not just app logic); a new trigger while one is RUNNING returns the existing runId (HTTP 202) — no duplicate work.
- **Abandoned-run recovery:** a RUNNING run older than 10 min (function timeout/crash) is marked FAILED ("timed out") **at the start of every new run attempt and on every read of that run** — otherwise a crashed run would block all future runs.
- Empty results: a pull provider returning 0 fixtures → SUCCESS with `scanned=0` and a warning note ("provider returned no fixtures"). An ingest/import payload with 0 matches → rejected with 422 (nothing to do).
- Run `error` is a short human sentence; per-item reasons live in `details`.
- FAILED never deletes or alters previously stored matches.
- **"Latest data" = most recent SUCCESS or PARTIAL run.**

### 6.3 Daily automated run (mode A)
1. Cron → `GET /api/cron/daily` (`Authorization: Bearer CRON_SECRET`; idempotent if a CRON run finished < 30 min ago).
2. Compute window (owner TZ): `[start of tomorrow, end of tomorrow(+1 if windowDays=2)]` → UTC.
3. Provider returns normalized `RawMatchInput[]`.
4. `processBatch`: validate → evaluate rule → upsert → `RunMatch` rows → close run.
5. Cleanup matches older than 90 days.

### 6.4 Owner-assisted ingest (mode B)
Owner opens PrediGoal (her own login) → clicks helper → helper reads only data her browser can already see → `POST /api/ingest` with token → run INGEST → dashboard updates. Helper shows progress and result. Token invalid/revoked → helper shows "Token rejected — create a new one in Settings".
**Helper form factor (decision D8):** a **userscript** (Tampermonkey/Violentmonkey) using `GM_xmlhttpRequest` is preferred: it runs in an isolated sandbox, is not blocked by PrediGoal's Content-Security-Policy or CORS, and keeps the ingest token out of the page's own JavaScript. A bookmarklet is only a fallback and may be blocked by CSP — recon must test this. Token blast radius is limited by design: ingest-only, revocable, rate-limited; it cannot read data or log in.

### 6.5 Manual import (mode C)
Paste/upload → preview → submit (session-protected) → run IMPORT → summary.

### 6.6 Run now (mode A)
Click → button disabled + spinner → `POST /api/run` (202 `{runId}`) → poll `GET /api/runs/[id]` every 2s (stop on terminal state or unmount; give up after 3 min with error + link to /runs) → toast ("3 qualifying matches found" / error) → refresh data.

### 6.7 Settings change effects
| Change | Effect |
|---|---|
| thresholds | saved, and the stored matches are re-screened in the same request (the dashboard lists stored verdicts); the UI says how many changed. If an update is running at that moment the re-screen is skipped and the UI shows "Re-screen to apply to stored matches" with a button (Maintenance has the same action). |
| windowDays | affects next run and the Day tabs; stored matches untouched |
| formScope | the next run/ingest must supply that scope: items whose `formScope` differs from the setting are **rejected** (reason "form scope mismatch: expected league") so the list is never a mix of league and overall form. Stored matches keep their own label. The helper/Import page tells the owner which scope to select on PrediGoal. |
| timezone | affects window computation and all displayed times immediately |
| accessMode | changes dashboard action/Import emphasis/cron behaviour immediately |
| password | invalidates all other sessions (session version bump) |

### 6.8 Re-screen
Transactional: re-evaluate every stored match with current thresholds → update `qualifies/strongSide/formGap` → show count changed.

### 6.9 Logout
Clears cookie → `/login`. Session TTL 30 days; expired session on any request → 401 → client redirects to `/login?next=…`.

## 7. Time rules (avoid the classic bugs)
- Store UTC; display in `Setting.timezone` (default `Europe/London`).
- "Tomorrow" = next calendar date in owner timezone (handles DST: 23h/25h days).
- Kickoff displayed `Sat 8 Nov · 19:45` (+ relative "in 1 day" on detail).
- Stale = hours since last SUCCESS/PARTIAL `finishedAt` (default 26h).
- Cron time on Vercel Hobby = once/day at fixed UTC (06:00 UTC ≈ 06:00/07:00 UK). `runHourLocal` is informational on Hobby.

## 8. Data contract
```ts
RawMatchInput {
  provider: string                 // 'predigoal'
  providerMatchId: string          // e.g. '1549544'
  sourceUrl?: https URL
  kickoffAt: ISO-8601 **with `Z` or explicit offset** (naive timestamps without a timezone are rejected — they cause silent day-shift bugs)
  league?: string; country?: string
  home: { name: string; logoUrl?: https URL; formPct: number /*0–100*/; lastResults?: ('W'|'D'|'L')[] }
  away: { same }
  formScope: 'league' | 'overall'
  probabilities: { homeWin?: number; draw?: number; awayWin?: number; btts?: number; over25?: number }
  //   0–100, missing = undefined (→ null). `btts` = probability of "Yes" (both teams to score); `over25` = probability of "Over 2.5".
  //   The source ALSO shows the complements ("No" 46%, "Under 2.5" 30%): these are DERIVED for display as 100 − value (decision D12), not stored.
  predictedScore?: { home: number; away: number }   // integers 0–20; the source's "Predicted score" (AI), e.g. 3–1; optional
  confidence?: 'LOW'|'MEDIUM'|'HIGH'
}
```
**Probability sanity checks (catch field-mapping mistakes):** when `homeWin`, `draw` and `awayWin` are all present their sum must be within 98–102 (rounding tolerance) — otherwise the item is rejected with "win/draw/win probabilities add up to {sum}, expected about 100" (this usually means a mapping or scraping error, and showing wrong numbers would defeat the tool's purpose). Each value must be 0–100. `predictedScore` goals must be integers 0–20. Display shows the complement values ("No" = 100 − Yes, "Under 2.5" = 100 − Over) clearly labelled.
Rule: `qualifies = (home.formPct > high && away.formPct < low) || (away.formPct > high && home.formPct < low)` (strict). Acceptance fixtures: Sporting Cristal 80 / FC Cajamarca 7 → qualifies; Atlético Madrid 44 / Bayern 56 → no; 75/35 → no; 76/34 → yes.
Normalization: `"80%"`, `"80 %"`, `80`, `80.0` → 80. A bare `0.8` is **ambiguous** (0.8% or 80%?) → rejected unless the payload declares `percentScale: "fraction"`. Values outside 0–100 → item rejected. Strings are trimmed and length-capped (names ≤ 80, league ≤ 80); URLs must be https. `fetchedAt` is set **by the server** at processing time (client clocks are not trusted); the most recent processed batch wins for any match. `lastResults` (optional) is a string/array of W/D/L, max 5.

## 9. State catalogue (all must exist as designed UI)
| State | Where | Behaviour |
|---|---|---|
| Navigation loading | route change | 2px lime top progress bar |
| Page loading | `loading.tsx` per route | skeleton identical in layout |
| Section loading | grid on filter change, run panel | section skeleton (Suspense) |
| Empty – no data yet | dashboard | onboarding (mode-specific) |
| Empty – none qualify | dashboard | explanatory text + scanned count |
| Empty – filtered out | dashboard | "Clear filters" |
| Stale data | dashboard | warning banner |
| Run in progress | dashboard, runs | pulsing chip, disabled action |
| Success | after run/save/import | toast + chip |
| Partial | runs/dashboard | warning chip + count of failed items |
| Error | any async view | ErrorState + Retry (idempotent) |
| Offline | global | persistent banner; mutating actions disabled **with visible helper text** (not tooltip-only: touch users can't hover); auto-recovers ("Back online") |
| Slow network | global | after 3s "Still working…" hint; 15s timeout → error with Retry |
| Session expired | any | redirect to login with `next` |
| Rate limited | login/ingest | 429 message with wait time |
| 404 / 500 | global | branded pages with way home |
| Disabled | controls | visible disabled style + reason as visible helper text (tooltip optional extra) |

## 10. API behaviour and error mapping
| Situation | HTTP | UI treatment |
|---|---|---|
| Not authenticated | 401 | redirect to login |
| Validation failed | 422 `{fieldErrors}` | inline errors |
| Wrong mode for action (`/api/run` in B/C) | 409 | toast + link to Import |
| Rate limited | 429 `Retry-After` | message with time |
| Payload too large | 413 | "File too large (max 1 MB)" |
| Provider not configured | 503 `PROVIDER_NOT_CONFIGURED` | ErrorState explaining setup needed |
| Unknown | 500 | generic ErrorState; details only in logs |

## 11. Edge cases (must be handled)
- Match appears in two runs → upsert, never duplicate; `lastRunId` updated.
- Match disappears from a later run (postponed/cancelled) → keep, not deleted; older than window simply isn't shown under day tabs. (Optional enhancement: mark `missingSince`.)
- Kickoff changes → update `kickoffAt`.
- Both teams > 75 or both < 35 → not qualifying.
- Form missing for one team → item rejected as invalid (counted in `failedCount`), not stored as 0.
- Probabilities missing/partial → store `null`, show "Unavailable".
- Duplicate ids in one payload → last wins, count once.
- Daylight-saving transitions (last Sundays of March/October) → correct windows.
- Very long team/league names → truncated with tooltip.
- Timezone changed after data stored → display only changes.
- Two browser tabs run simultaneously → single RUNNING run rule.
- Token revoked mid-ingest → current request completes or fails cleanly; next is rejected.

## 12. Order of operations (build dependency chain)
`Docs → Accounts & recon → Install → Agent context → Tokens/theme → Shared components & state kit → Shell & routes → DB → Auth → Domain (tested) → Providers/ingest → Run pipeline & cron → Dashboard → Detail → Runs → Settings/Import → Resilience → Animation polish → A11y/perf/security → Deploy → Audits → Handover`.

## 13. Out of flow (explicitly not present)
Registration, password reset by email, roles, notifications, betting slips, odds, payments, public pages.
