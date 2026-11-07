# HANDOVER CHECKLIST

For the developer, for the acceptance call with Danielle Way. Operating instructions are in [`RUNBOOK.md`](RUNBOOK.md); the client's guide is [`USER_GUIDE.md`](USER_GUIDE.md). Never put a password, token or database URL in this file or in chat.

## 1. Developer items still to do (manual)

| #   | Item                                                                                                                                                                                | Reference                                                         | Done |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---- |
| 1   | **Rotate the Neon database password** that was pasted in chat; update `DATABASE_URL`/`DIRECT_URL` in `.env.local`, `.env.test.local` and later Vercel                               | `DEPLOYMENT_RUNBOOK.md` 0.1                                       | [ ]  |
| 2   | Create a **separate production** Neon project/branch                                                                                                                                | `DEPLOYMENT_RUNBOOK.md` 0.2                                       | [ ]  |
| 3   | **Deploy** (19.2 / Step 17.1): Vercel project, env variables, migrations (`pnpm db:migrate` if `P1001`), `pnpm db:verify`, `pnpm prod:smoke`                                       | `DEPLOYMENT_RUNBOOK.md` 2-4                                       | [ ]  |
| 4   | Generate production `SESSION_SECRET`, `CRON_SECRET`; set a **production password** (`pnpm hash-password`, raw hash in the Vercel UI), then client sets her own in Settings -> Security | `DEPLOYMENT_RUNBOOK.md` 1                                         | [ ]  |
| 5   | **Gate G2 / D17:** obtain PrediGoal's written permission (contact@predigoal.com) before any automated or helper mode; record the answer in `PROJECT_STATE.md`. Until then manual import only | `PROJECT_SCOPE.md` 10                                             | [ ]  |
| 6   | **Real-device check (15.3):** phone and desktop, real browsers                                                                                                                      | `PROJECT_STATE.md` step 15.2-15.3                                 | [ ]  |
| 7   | **Real-data comparison (17.2):** import 10 sampled real matches, compare every value with PrediGoal (must be identical), check UK kickoff times                                     | `DEPLOYMENT_RUNBOOK.md` 5                                         | [ ]  |
| 8   | Confirm the client changed the Google password she pasted in chat                                                                                                                   | `PROJECT_STATE.md` 3                                              | [ ]  |
| 9   | Transfer GitHub, Neon and Vercel to the client, rotate secrets in her accounts, revoke old tokens, remove your access (Step 19.2)                                                   | master guide Step 19.2                                            | [ ]  |
| 10  | Run `pnpm secret-scan` and `git log -p -S` for secrets before transferring the repository                                                                                          |                                                                   | [ ]  |
| 11  | Update `PROJECT_STATE.md` to "Delivered (pending client acceptance)" with the date                                                                                                   |                                                                   | [ ]  |

## 2. Acceptance walk-through (client call)

Use real or fixture data. "Expected" is what the product does today.

| #   | Scenario                                                              | Expected                                                                                                              |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Open the URL signed out                                               | Redirects to the login page                                                                                           |
| 2   | Sign in with a wrong password                                         | Clear error; after 5 failures within 15 minutes a lockout message with the wait time                                  |
| 3   | Sign in correctly on phone and laptop                                 | Dashboard opens                                                                                                       |
| 4   | Empty dashboard (no data yet)                                         | Friendly empty state pointing to Import                                                                               |
| 5   | Import: open Import, Paste / upload, paste one real match page text   | Preview shows form %, probabilities, kickoff; Import reports "Imported 1 matches"                                     |
| 6   | Import a match with form 80 / 7                                       | Qualifies and appears on the dashboard with all figures                                                               |
| 7   | Import 30 / 82 (away is the strong side)                              | Qualifies                                                                                                             |
| 8   | Import 76 / 34                                                        | Qualifies                                                                                                             |
| 9   | Import 75 / 35, 44 / 56, 50 / 50                                      | None qualify (imported but not on the dashboard)                                                                      |
| 10  | Import the same match twice                                           | Updated in place, no duplicate                                                                                        |
| 11  | Import text with wrong form scope or a missing value                  | Item skipped with a readable reason; valid items still saved; run shows PARTIAL                                       |
| 12  | Open a card, then the match page                                      | Same figures; "No" and "Under" shown as 100 minus Yes/Over; a missing value reads "Unavailable", never 0              |
| 13  | Dashboard tabs, search, sort, reload the page                         | Filters live in the URL and survive reload and Back                                                                   |
| 14  | Runs page                                                             | Imports listed with counts and reasons; SKIPPED cron runs hidden unless "Show skipped"                                |
| 15  | Settings: change thresholds                                           | Live preview updates; saving re-screens stored matches; low must stay below high                                      |
| 16  | Settings: timezone, days ahead, form type, stale hours                | Saved; times shown in the chosen timezone                                                                             |
| 17  | Stale data: set stale hours to 1 on data older than an hour (then reset) | Banner and freshness pill warn; data still visible                                                                  |
| 18  | Change password; keep a second device open                            | Success message; the second device is signed out on its next request                                                  |
| 19  | Go offline in the browser                                             | Offline banner; Import and other actions disabled with a reason; works again when back online                         |
| 20  | Cron (after deploy): Vercel -> Cron Jobs -> Run                       | A SKIPPED run is recorded in manual mode                                                                              |
| 21  | `/api/health` signed out                                              | `{"ok":true,"db":true}` only                                                                                          |
| 22  | Client reads `USER_GUIDE.md` and imports unaided                      | Gets results in under 5 minutes                                                                                       |

## 3. Known limitations

| Limitation                         | Detail                                                                                                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No automatic data fetching         | Needs PrediGoal's written permission (D17). Manual paste/upload import is the delivered mode; the helper UI says it is not available yet. It saves effort, not all of the daily checking. |
| JavaScript size above target       | Initial JS is about 311-366 KB gzipped per route (`/login` 317, `/` 364, `/runs` 350, `/settings` 366, match page 311) against the 200 KB target. Framework and Framer Motion dominate; trimming Framer (LazyMotion) is pending. |
| `pnpm audit`                       | 1 high, 2 moderate, 1 low, all transitive development tooling (for example minimatch via eslint-config-next, deepmerge via the shadcn CLI), none in runtime code. No fix for deepmerge. Re-run `pnpm audit` before delivery. |
| Lighthouse not run                 | Only local production timings were taken (login at 390px: LCP 164 ms, CLS 0.004). Run Lighthouse on the deployed URL.                                                    |
| Dark theme only                    | No light theme (decision D6).                                                                                                                                           |
| Real devices untested              | Step 15.3 and the 4x CPU throttle trace were not run.                                                                                                                   |
| Unseen PrediGoal card              | The card below Over/Under 2.5 on her screenshot is not in v1 (D15).                                                                                                     |
| Hosting limits                     | Vercel Hobby cron: once a day, may start up to an hour late; 06:00 UTC is 06:00 UK in winter and 07:00 in summer.                                                       |
| Single user                        | One password, no roles, no accounts.                                                                                                                                    |
| Final audits                       | Step 18 (final audits) was not completed in this documentation pass; a full e2e run on the merged tree is still advisable.                                              |
