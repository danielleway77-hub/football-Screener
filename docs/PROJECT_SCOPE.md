# PROJECT_SCOPE.md — Football Match Screener (v2, complete scope)

> Source of truth for *what* is being built. Behaviour: `ApplicationFlow.md`. Visuals: `ThemeGuideline.md`. Structure: `ARCHITECTURE.md`.

## 1. Source evidence (what the client sent, when, and why)
| # | Source | When / why it was sent | What we take from it |
|---|---|---|---|
| 1 | **Fiverr Mira brief PDF** | Sent by Mira with the first message (prepared 01 Nov 2026) | Formal request: personal-use web tool; screen matches 1–2 days ahead; form > 75% vs < 35%; show win/draw/BTTS/over-2.5 probabilities; developer must check for an **authorized** data-access method; "simpler first version"; budget ceiling £300 (shown as $300); goal = cut "several hours" of daily manual checking; PrediGoal reference; client UK-based. States data is **dynamically loaded** and whether the tool is self-run or unattended "remain[s] to clarify". |
| 2 | **Link `predigoal.com`** (chat, 1:06) | Reply to dev's request for subscription access | The data source. She subscribes; login = Gmail → "access through Whop" → **access code**. |
| 3 | **Image #1** (`Refrence/image.png`; chat 1:15) | "I open each match and look at these stats; if one is above 75% and one below 35% I want the other information, if not I go to the next match" | Defines the **screening input**: the *Recent Form* block (team form %, "Poor/Average shape", W/D/L badges, last results, "League form" selector, AI-confidence meter). Also the **visual direction** (near-black, neon-lime). Example shown: Atlético Madrid 44% vs Bayern 56% → does **not** qualify. |
| 4 | **Match link** `predigoal.com/en/analyze?id=1549544` (1:17) | "Tomorrow the only match that fits is…" | Real acceptance case: **Sporting Cristal 80% vs FC Cajamarca 7%** qualifies. |
| 5 | **Image #2** (`Refrence/image2.jpeg`; chat 1:18) | "so then I want the information below" (for Sporting Cristal vs FC Cajamarca) | Defines **what to display for a qualifying match** — PrediGoal's **"EXACT PROBABILITIES" (AI)** panel: **Predicted score** `3 – 1`; **Win Sporting Cristal 76% · Win FC Cajamarca 8% · Draw 16%** (three bars; sum 100); **Both teams to score: Yes 54% / No 46%**; **Over/Under 2.5 goals: Over 70% / Under 30%**. The screenshot is cut off at the bottom: **another card starts below Over/Under** (unknown — ask the client). Form was 80% vs 7%, so the win probabilities (76/8) are separate numbers from the form %. |
| 6 | Chat text | 02 Nov | Wants zero manual daily work ("open the dashboard and see results"); only has a PrediGoal subscription (no GitHub/Vercel/Google dev accounts); offer made at US$280; chat says 6 days, Fiverr offer says 10 days. |
Pricing/time chatter is out of scope for the build.

> ⚠️ The client pasted a Google password in chat. It must never be used, stored, or copied into any file. Ask her to change it (see Step 0.1 of the master guide).

## 2. Product purpose and success
**Purpose:** replace hours of manual match checking with an automatic screen that shows only qualifying matches and their probabilities.
*How the owner's day changes:* before — open each match on PrediGoal, read form % for both teams, write down the rare qualifying ones, then read probabilities. After — open the dashboard (mode A) or press the helper once (modes B/C), read the qualifying cards.
**Success measures (acceptance):**
1. Daily time to get the list drops from hours to < 2 minutes (open dashboard / one click in B/C modes).
2. 100% of values shown (form %, win/draw/win, BTTS, over/under 2.5, predicted score) match PrediGoal for 10 sampled matches.
3. Qualifying list equals the owner's manual result on 3 consecutive days (or differences are explained by the boundary rule).
4. Zero P0/P1 defects at delivery.

## 3. Users
One: the owner (Danielle Way, UK, personal use). No sign-up, roles or multi-tenancy. Default timezone `Europe/London`. Devices: phone and laptop.

## 4. In scope (MVP — the agreed offer)
1. Private login (single password; change-password in Settings).
2. Daily screening of fixtures 1–2 days ahead.
3. Rule: one team form **> 75** and the other **< 35** (thresholds configurable; strict inequalities by default).
4. For each qualifying match show (mirroring PrediGoal's "Exact probabilities" panel, image #2): both form %; **predicted score** (e.g. 3–1) when the source provides it; **win home / draw / win away**; **both teams to score — Yes and No**; **over/under 2.5 goals — Over and Under**; plus league, kickoff (owner TZ), confidence if available, data freshness, link to source.
5. Dashboard: filters (day, league search), sort, stats, run status, primary action by mode.
6. Match detail page.
7. Run history with errors.
8. Settings: thresholds, window (1/2 days), form scope (league/overall), timezone, access mode, stale hours, ingest tokens, password change, re-screen.
9. Import page (paste/upload with preview **and smart paste of text copied from a match page — the compliant default**) and, **only with PrediGoal's written permission**, an owner-assisted helper.
10. Data-access abstraction with three modes; the delivered mode = the one confirmed in recon.
11. Daily automation (Vercel Cron) for mode A; stale-data detection for all modes.
12. Premium responsive UI (360 → 2560 px), premium animation, complete state coverage (loading, skeleton, empty, error, offline, slow, stale, success, disabled).
13. Neon Postgres + Prisma, Vercel deployment, automated tests, runbook, client guide, ownership transfer.

## 5. Out of scope (state clearly to the client)
Betting advice/tips, odds comparison, staking, own prediction models, accuracy tracking/backtests, multiple users, payments, email/Telegram notifications, historical analytics, additional data sources, mobile apps, **bypassing login/2FA/paywalls/captchas or any PrediGoal protection**, scraping beyond the owner's own authorized use, hosting costs beyond free tiers (client pays any plan upgrades), custom domain purchase.
**Optional paid add-ons (quote separately):** Telegram/email alert when qualifying matches appear; CSV export; extra thresholds profiles; additional leagues filters; second data source.

## 6. Functional requirements (testable)
| ID | Requirement |
|---|---|
| FR1 | Rule uses strict `> high` and `< low`; either team may be the strong side; both-high/both-low never qualify. |
| FR2 | **Screening window** = fixtures whose kickoff **date in owner TZ** is tomorrow (and day after if `windowDays=2`), DST-safe. **Dashboard view** = all stored qualifying matches with `kickoffAt >= now`, with tabs Upcoming/Today/Tomorrow/Day after computed from today's date in owner TZ. |
| FR3 | Each qualifying match shows 2 form values + win/draw/win + BTTS (Yes/No) + Over/Under 2.5 (+ predicted score when provided); a missing value shows "Unavailable" (never 0); No/Under are derived as 100 − Yes/Over. |
| FR3b | When all three of win/draw/win are present their sum must be within 98–102, otherwise the item is rejected with a clear reason (guards against wrong field mapping). |
| FR4 | Runs are idempotent: unique `(provider, providerMatchId)`; re-run never duplicates. |
| FR5 | A failed run never deletes/changes earlier data and shows a readable error. |
| FR6 | Stale banner when last successful data is older than `staleAfterHrs` (default 26). |
| FR7 | Settings validated (`0 ≤ low < high ≤ 100`); "Re-screen" re-evaluates stored matches transactionally. |
| FR8 | All routes/APIs require a session except `/login`, `/api/auth/*`, `/api/health`; `/api/cron/*` requires `CRON_SECRET`; `/api/ingest` requires an active ingest token. |
| FR9 | Acceptance fixtures: 80/7 ✔, 30/82 ✔ (away strong), 76/34 ✔, 75/35 ✘, 44/56 ✘, 50/50 ✘. |
| FR10 | Only one run executes at a time; duplicate triggers return the running run. |
| FR11 | Ingest accepts ≤ 500 matches / ≤ 1 MB; invalid items are reported individually (PARTIAL), valid ones stored. |
| FR12 | Filters/sort/day are stored in the URL and survive reload/back. |
| FR13 | Times are displayed in the configured timezone. |
| FR14 | Login rate-limited (5 failures / IP / 15 min). |
| FR15 | Ingest tokens are shown once, stored hashed, revocable, rate-limited (30/h/token). |
| FR16 | Items whose form scope differs from the configured scope are rejected with a clear reason (never mix league and overall form). |
| FR17 | Naive timestamps (no `Z`/offset) and ambiguous fractions (`0.8` without declared scale) are rejected, not guessed. |
| FR18 | Changing the password invalidates all other sessions (session version). |
| FR19 | A crashed/timed-out run (RUNNING > 10 min) is marked FAILED automatically and never blocks later runs. |

## 7. Non-functional requirements
- **Responsive:** every page/state perfect at 360, 390, 768, 1024, 1280, 1536, 1920, 2560; no horizontal scroll; touch targets ≥ 44px.
- **Performance:** Lighthouse mobile ≥ 90 (performance, a11y, best practices) on `/login` and the dashboard (dashboard is behind login: run Lighthouse with an authenticated session cookie, e.g. via Playwright-launched Chrome/Lighthouse CI with `extraHeaders`/storage state, or Chrome DevTools while logged in on a **production build**; never audit `next dev`); LCP < 2.5s on fast 4G; CLS < 0.05; JS for dashboard route < 200 KB gz (target).
- **Accessibility:** WCAG 2.1 AA; keyboard operable; axe 0 serious/critical; colour never the only signal (W/D/L letters, ↑/↓ icons); `prefers-reduced-motion` respected.
- **Security:** secrets only in env; bcrypt; httpOnly+Secure cookies; hashed tokens; zod validation at every boundary; CORS only for ingest origin; CSP + security headers; no third-party credentials stored; `noindex`.
- **Reliability:** idempotent ingestion; previous data preserved on failure; health endpoint; clear errors in `/runs`.
- **Maintainability:** reusable components, domain logic isolated and ≥ 95% covered, docs kept current.
- **Browser support:** latest 2 versions of Chrome, Safari (iOS/macOS), Firefox, Edge.

## 8. Tech stack (fixed)
Next.js (App Router, TypeScript strict) · Tailwind CSS · shadcn/ui (Radix) · Framer Motion (+ GSAP for login entrance, optional Animate.css) · Neon Postgres + Prisma · Vercel (hosting + Cron) · zod · jose + bcryptjs · Vitest + React Testing Library + MSW + Playwright + axe · pnpm.

## 9. Data requirements
Per match (see `ApplicationFlow.md` §8): provider id, source URL, kickoff, league/country, home/away name + logo, home/away form % (+ scope), optional last results, five probabilities, optional confidence. **Exact field list to be confirmed from Image #2 before UI build.** Retention: matches kept 90 days after kickoff; login attempts 30 days. No personal data except the owner's login (IP addresses in `LoginAttempt` are personal data under UK GDPR → short retention, documented in the runbook; a single-user private tool, so no cookie banner is needed beyond the strictly necessary session cookie).

## 10. Legal, compliance and ethics
- Personal-use tool for the owner's own PrediGoal subscription. Developer must not use or store her credentials; must not bypass authentication/2FA/rate limits; must not republish PrediGoal's data.
- **Research finding (2026-11-03, public pages):** PrediGoal advertises **no API/developer access/export**. Its Terms of Service (predigoal.com/terms) §7 prohibits "scraping, reverse engineering" and "using automated systems without permission", and forbids copying, reselling, redistributing or commercially exploiting its analysis/data; §9 grants a licence for **personal, lawful use**. Support is **contact@predigoal.com**. Therefore **automated or assisted extraction (modes A/B) requires PrediGoal's WRITTEN permission** (decision D17); without it the compliant deliverable is manual-assist mode **C-lite** (D18), which saves effort but not "hours" — be explicit with the client. Hosting a private copy of her own screening results for her personal use is consistent with §9; never expose the data to anyone else.
- Ask PrediGoal (the client, or the developer with her explicit written authorisation) by email for written confirmation that automated/assisted access with her subscription is allowed, or an API. Record the answer in `PROJECT_STATE.md`.
- If automated access is not permitted → deliver mode C (manual import) and explain why in writing.
- Show disclaimer: "Probabilities come from the data source; this tool does not give betting advice."
- UK context: gambling-related content — no encouragement of gambling, no promotional language. The tool is an information filter only.

## 11. Assumptions
A1 Thresholds are exclusive (> 75, < 35) · A2 "League form" is the default form scope (as in the screenshot) · A3 "1–2 days ahead" = tomorrow and the day after · A4 Single daily update is enough · A5 English UI only · A6 Free tiers (Vercel Hobby, Neon Free) are sufficient · A7 Subscription access is used only in a permitted way (screenshot #2 is received) · A9 Predicted score is shown when provided · A10 The card below Over/Under 2.5 in her screenshot is out of v1 · A8 Data volume ≤ ~500 fixtures/day.
Each assumption must be confirmed or changed and logged in `PROJECT_STATE.md`.

## 12. Risks and mitigations
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| No official API; Whop access code blocks unattended login | High | High | Three-mode design; recon in Step 0.7; honest expectation-setting; never bypass 2FA |
| **PrediGoal ToS §7 prohibits automated systems without permission; no API advertised** | **High (confirmed by public terms)** | High — client's subscription and your reputation | Written permission request to contact@predigoal.com (template in master guide Appendix C); no helper/automation until granted (D17); compliant fallback C-lite (D18); be honest with the client about the value of each mode |
| Site markup/endpoints change | Medium | Medium | Provider adapter + isolated mapping layer + fixtures + clear run errors |
| Helper blocked by PrediGoal CSP/CORS (bookmarklet) | Medium | Medium | Prefer userscript (`GM_xmlhttpRequest`); test in recon; fall back to mode C |
| Helper makes the client's account look like a bot (rate limits/ban) | Low–Med | High (her subscription) | Polite pacing (≥1 s, 1 concurrent), only 1–2 days of fixtures, run once/day, client informed and consenting in writing |
| Wrong form scope mixed into data | Medium | Medium | FR16 rejection; helper tells her which scope to select |
| Client credentials exposure | Occurred | High | Ask to change password; never store; token-based ingest |
| Vercel Hobby cron limits (1/day, ±1h) | Certain | Low | Acceptable; documented |
| Image #2 is cut off (a further card below Over/Under is not visible) → possible missing field | Medium | Medium | Ask the client what else she reads below Over/Under 2.5 and whether the Predicted score is needed; confirm in chat before Step 10 |
| Source gives complements (No / Under) | Certain | Low | Derive 100 − Yes/Over, labelled; verify against the source in Step 17.2 |
| Scope creep vs $280/£300 budget | Medium | Medium | Change control (§14); add-ons priced separately |
| Neon cold starts | Low | Low | Pooled connection; skeletons |
| Client unresponsive | Medium | Medium | Defaults + assumptions logged; deliver with documented defaults |

## 13. Open questions for the client (ask once, in one message)
> **Developer decisions made (2026-11-03) so work is never blocked** — the client may override any of these in chat; each is a setting or a small change: strict thresholds (> 75, < 35) · league form · tomorrow + day after · Europe/London with a daily check at 06:00 UTC · predicted score shown when available · probability order Home · Draw · Away · the unseen card below Over/Under is out of v1 (add-on if she names it) · access plan = one-click userscript helper (B) with manual import (C) as fallback, official API (A) only if granted. The list below is therefore a *confirmation* message, not a prerequisite.
1. Exclusive or inclusive thresholds? 2. League form or overall form? 3. Tomorrow only, or tomorrow + day after? 4. Daily time + timezone? 5. **Screenshot #2 received** — please also confirm: (a) is the **Predicted score (3–1)** something you want shown? (b) the screenshot is cut off: what else do you read **below "Over/Under 2.5 goals"** that you need? 6. If no API exists, is a one-click daily helper/paste acceptable? 7. Can she ask PrediGoal about API/automation permission? 8. Does she want alerts later (add-on)?

## 14. Change control
Anything not in §4 is a change request: record in `PROJECT_STATE.md` as "proposed", estimate impact, get written approval in Fiverr chat, then add to scope. No unapproved features.

## 15. Milestones (target 10 working days maximum, offer says 10; chat says 6)
M1 Docs+accounts+recon (D1) · M2 Foundation: install, tokens, shared kit, shell (D2–3) · M3 DB+auth+domain (D3–4) · M4 Providers/ingest/pipeline (D4–5) · M5 Dashboard+detail+runs (D5–7) · M6 Settings/import/resilience (D7–8) · M7 Polish+hardening (D8–9) · M8 Deploy+real-data verification+audits+handover (D9–10). Tell the client the realistic date after recon.

## 16. Deliverables
Deployed URL · repository transferred to client · Neon + Vercel projects transferred (or recreated in her accounts) · documentation (`CLIENT_GUIDE`, `RUNBOOK`, `README`) · short walkthrough video · 14 days bug-fix support.

## 17. Definition of Done
All FR/NFR pass · every master-guide step's tests and bug-hunt signed off in `PROJECT_STATE.md` · final audits (Step 18) have no open P0/P1 · production verified with real data matching PrediGoal · secrets rotated and transferred · client acceptance recorded in chat.

## 18. Glossary
**Form %** PrediGoal's recent-form score for a team. **Qualifies** passes the screening rule. **Window** the 1–2 day fixture range. **Run** one screening execution. **Ingest** receiving data from the owner's browser. **BTTS** both teams to score. **Over 2.5** more than 2.5 total goals. **Stale** older than `staleAfterHrs`.
