# RUNBOOK - operating the Football Match Screener

For the owner/operator. First deployment is in [`DEPLOYMENT_RUNBOOK.md`](DEPLOYMENT_RUNBOOK.md); developer setup is in the [`README`](../README.md). Never paste passwords, tokens or database URLs into chat, tickets or files.

## 1. Daily operation

The delivered mode is **manual import** (Settings -> Data access = "manual import"). Nothing fetches data by itself.

1. The client opens PrediGoal herself, copies match pages and pastes them on **/import** (steps in [`USER_GUIDE.md`](USER_GUIDE.md)).
2. The app screens the matches against the saved thresholds and the dashboard shows the qualifying ones.
3. The daily cron (`/api/cron/daily`, 06:00 UTC) only records a SKIPPED run and does housekeeping (section 5). It does not fetch data in this mode.

Your daily check as operator is optional: open `/runs` (or `/api/health`) and confirm the latest run is not FAILED and the dashboard is not STALE.

Modes other than manual import (`assisted_ingest`, `official_api`) exist in code but must not be used without PrediGoal's **written permission** (decision D17, gate G2). The Import page shows "The one-click helper is not available yet."

## 2. Run statuses

Shown on `/runs` and in the dashboard status card.

| Status    | Meaning                                                                                                                            | Action                                                                          |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `RUNNING` | An update is in progress. Only one run can be RUNNING at a time (database unique index).                                           | Wait. Over 10 minutes it is marked FAILED automatically.                         |
| `SUCCESS` | Every item was stored and screened.                                                                                                | None.                                                                           |
| `PARTIAL` | Some items were rejected (bad value, wrong form scope, naive timestamp, 1X2 not summing to about 100); the valid ones were stored. | Open the run: each skipped item has a one-line reason. Fix the source and re-import. |
| `FAILED`  | The run itself failed. Earlier data is untouched.                                                                                  | Read the message in the run, see section 7.                                      |
| `SKIPPED` | The cron ran in a push mode and had nothing to pull. Hidden on `/runs` unless "Show skipped" is on.                                | None.                                                                           |

The dashboard card can additionally show **NO DATA** (nothing imported yet) and **STALE** (see section 3).

## 3. Stale data

Data is stale when the last successful update is older than **Settings -> stale after (hours)** (default 26, range 1-168). Effects:

- A stale banner appears on every page, and the dashboard summary and the navbar freshness pill turn to a warning state.
- Nothing is deleted or hidden: the stored matches stay visible. A failed or partial run never removes earlier data.
- The fix is to import again. Kickoff times in the past drop out of the "Upcoming" view automatically.

## 4. Ingest tokens, password, sessions

**Tokens** (only needed if a helper is ever permitted): Settings -> Ingest tokens. Create gives a label and shows the token **once**; only a hash is stored. At most 5 active tokens. Revoke from the same list (the helper using it stops working). Command-line alternative: `pnpm token:create "label"`. Ingest is also rate limited per token.

**Change password / "log out everywhere":** Settings -> Security needs the current password and a new one of at least 10 characters. Saving stores a new hash in the database (this **overrides** `APP_PASSWORD_HASH`) and bumps the session version, which signs out **every other device**. To sign out everyone without changing the password, rotate `SESSION_SECRET` (section 8). Normal sessions last 30 days. Wrong passwords on the change form are rate limited.

**Forgot the password:** generate a new hash with `pnpm hash-password`, set it as `APP_PASSWORD_HASH`, and redeploy. If a password was previously set in the app, that stored one wins over the env value, so clear the `Credential` row in the database first (Neon SQL editor: `DELETE FROM "Credential";`), then sign in with the env password.

**Login throttle:** 5 failed attempts per IP in 15 minutes locks that IP out; the page shows how long to wait.

## 5. Retention (runs on every daily cron call)

| Data                       | Kept                          |
| -------------------------- | ----------------------------- |
| Matches                    | 90 days after kickoff         |
| Login attempts (IP address) | 30 days (personal data, short) |
| Rate-limit counters        | 2 days                        |
| Run history                | 365 days (finished runs; RUNNING never deleted) |

## 6. Backups and Neon

- Neon keeps point-in-time history on its free plan for a limited window (check the current limit in the Neon console). Restore: Neon console -> Branches -> Restore to a time. Never edit `_prisma_migrations` by hand.
- Use a separate Neon project or branch for production and one for development; previews must use the dev one.
- The data is re-creatable by re-importing from PrediGoal, so there is no separate backup job. Settings (thresholds etc.) live in one row; note them if they matter.
- Verify a database at any time, read-only: set `DIRECT_URL` in the shell and run `pnpm db:verify`.
- Health: `/api/health` returns `{"ok":true,"db":true}` when signed out.

## 7. Troubleshooting

| Symptom                                       | Likely cause                                                                       | Fix                                                                                                  |
| --------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| App will not start, "must be a bcrypt hash"   | `$` in `APP_PASSWORD_HASH` expanded by dotenv (local) or quoted (Vercel)           | Local: escape each `$` as `\$`. Vercel: paste raw, no quotes. Redeploy.                              |
| Login always fails in production              | Hash mangled, or wrong password                                                    | Re-paste the hash, redeploy; check `/api/health`.                                                    |
| "Too many attempts"                           | 5 failures in 15 minutes                                                           | Wait the time shown.                                                                                 |
| Everyone suddenly signed out                  | `SESSION_SECRET` changed, or password changed                                      | Expected; sign in again.                                                                             |
| Cron returns 401                              | `CRON_SECRET` missing or different in the Vercel project                           | Set it, redeploy.                                                                                    |
| Dashboard empty after import                  | All items rejected, or form scope mismatch                                         | Open `/runs` -> the run; each reason is listed. The page text must be copied with the scope set in Settings (league or overall). |
| Matches missing that should qualify           | Thresholds are strict (`> 75`, `< 35`): 75 / 35 do not qualify                     | Check Settings; "Re-screen" re-evaluates stored matches.                                             |
| Wrong "tomorrow" / odd kickoff times          | Timezone setting                                                                   | Settings -> timezone (default Europe/London).                                                        |
| `P1001` on `pnpm db:deploy`                   | Prisma schema engine cannot reach Neon from the dev PC                             | Use `pnpm db:migrate`.                                                                               |
| "another update is running"                   | A run holds the single RUNNING slot                                                | Wait a minute; after 10 minutes it is auto-FAILED.                                                   |
| Build fails on env validation                 | Missing variable                                                                   | Compare Vercel variables with `.env.example`.                                                        |
| Run stuck RUNNING                             | Function timed out                                                                 | Auto-FAILED after 10 minutes; check Vercel logs.                                                     |

## 8. Rotating secrets

Full table with the Neon and account steps: [`DEPLOYMENT_RUNBOOK.md`](DEPLOYMENT_RUNBOOK.md) section 7. In short:

| Secret              | How                                                                              | Effect                                       |
| ------------------- | -------------------------------------------------------------------------------- | -------------------------------------------- |
| Neon password       | Neon -> Roles -> Reset password; update `DATABASE_URL` and `DIRECT_URL`; redeploy | Brief outage until redeployed                |
| `SESSION_SECRET`    | New 64-hex value in Vercel; redeploy                                             | Everyone signed out                          |
| `CRON_SECRET`       | New value in Vercel; redeploy                                                    | Vercel Cron picks it up automatically        |
| App password        | Settings -> Security (or new `APP_PASSWORD_HASH`)                                | Other devices signed out                     |
| Ingest token        | Settings -> revoke, create new                                                   | Old token stops working                      |

Env changes only apply to new deployments, so always redeploy.

## 9. Incident steps

1. **Suspected leak** (a secret or the password seen by someone else): rotate the Neon password, `SESSION_SECRET`, `CRON_SECRET` (section 8), revoke all tokens, change the app password. Remove unknown collaborators from GitHub, Vercel and Neon.
2. **Bad deployment:** Vercel -> Deployments -> last good one -> Promote to Production.
3. **Bad data imported:** re-import the correct data (same match ids update in place, never duplicate). If thresholds were wrong, fix them and use Settings -> Maintenance -> Re-screen.
4. **Cron misbehaving:** Vercel -> Settings -> Cron Jobs -> disable; investigate in `/runs` and Vercel logs.
5. **Database problem:** `pnpm db:verify` against production (read-only); restore via Neon Branches -> Restore if needed.
6. Record what happened and what changed in `PROJECT_STATE.md` (no secrets).

## 10. Reading logs and request ids

Logs are JSON lines (one object per line): `{"time","level","msg","requestId?",...}`; set `LOG_LEVEL=debug|info|warn|error` (default `info`). Passwords, tokens, cookies and connection strings are redacted automatically. Every API response carries an `x-request-id` header and error bodies carry `error.requestId`; when the owner reports a problem, ask for that id and search the Vercel log for it. A client may send its own `x-request-id` (8-64 chars `A-Za-z0-9._-`) and it is reused.
