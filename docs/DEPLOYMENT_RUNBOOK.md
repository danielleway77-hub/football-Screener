# DEPLOYMENT_RUNBOOK.md — Step 17 (owner checklist)

> Steps 17.1 (Vercel deploy) and 17.2 (first real-data run) are MANUAL: they need the owner's Vercel, GitHub and Neon accounts. Everything below is copy-paste PowerShell. **Never paste secrets into chat, commits, docs or screenshots.** Run all commands from the repo root (`D:\WEB DEV\Daniel\football-screener`).

Prepared (2026-11-07, branch `step-17-deploy-prep`): security headers in `next.config.ts`, `pnpm prod:smoke`, `pnpm db:verify`, the `.env.example` consistency test, and a local production rehearsal (see `TEST_LOG.md`). Nothing has been pushed or deployed.

## 0. Before you start (blocking items)

| # | Item | Why |
|---|---|---|
| 0.1 | **ROTATE the Neon database password** (Neon console → project → Roles → `neondb_owner` → Reset password). The old one was pasted in chat and must be treated as leaked. Then update `DATABASE_URL`/`DIRECT_URL` in `.env.local` and `.env.test.local` on the dev PC. | credential exposure |
| 0.2 | Use a **separate Neon project or branch for production** (dev data and production data must not share a database). Copy its **pooled** string (host contains `-pooler`) and **direct** string (no `-pooler`). | isolation |
| 0.3 | All steps 0–16 merged to `main`; `pnpm build` green. | prerequisite |
| 0.4 | Decide the data mode. **Gate G2 / decision D17:** modes A (official API) and B (userscript helper) are allowed ONLY with PrediGoal's written permission (email contact@predigoal.com; ToS §7 forbids automated systems without permission). Without it, deploy **mode C-lite (D18)**: the owner copies the visible match page text herself and pastes it on **/import**; nothing is scraped, no PrediGoal or Google credentials are ever stored. Do not set `PROVIDER_API_*` and do not create ingest tokens in C-lite. | legal/ToS |
| 0.5 | Gate G3 conditions met (client acceptance of the staging build). | process |

## 1. Generate the production secrets (local, nothing is saved)

```powershell
# SESSION_SECRET (64 hex chars) - copy the output into the Vercel UI, then close the window
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# CRON_SECRET (a DIFFERENT value)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# APP_PASSWORD_HASH: prompts with hidden input and prints ONLY the bcrypt hash ($2b$12$...)
pnpm hash-password
```

Use a strong temporary production password; the client's real one is set at handover (Settings → Password; that stores a Credential row which then overrides the env hash).

### The `$` escaping lesson (bcrypt hashes contain `$`)

| Where the hash goes | What to do |
|---|---|
| `.env.local` (dev PC) | Wrap in **single quotes**: `APP_PASSWORD_HASH='$2b$12$abc...'`. Next's dotenv-expand otherwise reads `$2b` as a variable and truncates the value → startup error "APP_PASSWORD_HASH must be a bcrypt hash". |
| **Vercel UI** (Settings → Environment Variables) | Paste the raw hash **without quotes**. Vercel does not expand `$`; quotes would become part of the value and break the regex. |
| A process env var on the PC that ALSO has a `.env.local` key of the same name | dotenv-expand still interpolates it. Escape each `$` as `\$` (found while rehearsing the production build locally). Not needed on Vercel (no `.env` files there). |

If login fails with the right password in production: the hash was mangled. Check `/api/health` is fine, then re-paste without quotes and redeploy.

## 2. Environment variables (must match `.env.example`; a test enforces it)

Enter these at Vercel → Project → Settings → Environment Variables. **Production** secrets are scoped to **Production only**; Preview gets different values pointing at the **dev** Neon so previews never touch production data.

| Name | Production | Preview | Notes |
|---|---|---|---|
| `DATABASE_URL` | NEON_PROD pooled (`-pooler`), `?sslmode=require` | NEON_DEV pooled | secret |
| `DIRECT_URL` | NEON_PROD direct (no `-pooler`) | NEON_DEV direct | secret, migrations |
| `SESSION_SECRET` | new 64-hex (section 1) | a different random value | secret, ≥ 32 chars |
| `CRON_SECRET` | new 64-hex, different from SESSION_SECRET | a different random value | secret, ≥ 32 chars; Vercel Cron sends it automatically as `Authorization: Bearer` |
| `APP_PASSWORD_HASH` | bcrypt hash, **no quotes** | hash of a throwaway preview password | **required in production** (app refuses to start without it) |
| `NEXT_PUBLIC_APP_URL` | `https://<project>.vercel.app` (set after first deploy, then redeploy; later the custom domain) | the preview URL or leave the production URL | the ONLY `NEXT_PUBLIC_` variable; public, not secret. Login/CORS origin checks use it. |
| `INGEST_ALLOWED_ORIGINS` | `https://predigoal.com` | `https://predigoal.com` | comma-separated https origins |
| `PROVIDER_API_BASE`, `PROVIDER_API_KEY` | **leave unset** unless mode A is permitted | unset | optional |
| `LOG_LEVEL` | optional (`info`) | optional | |

Not Vercel variables: `DATABASE_URL_TEST`, `DIRECT_URL_TEST`, `E2E_PASSWORD` (tests only, `.env.test.local`). `NODE_ENV` is set by Vercel.

After saving, compare the Vercel list with `.env.example`: nothing missing, nothing extra, no secret under a `NEXT_PUBLIC_` name.

## 3. Deploy (17.1)

1. https://vercel.com/new → Import `football-screener` (GitHub) → Framework **Next.js** (auto). Add the section-2 variables, then **Deploy**.
2. Note the production URL. Set `NEXT_PUBLIC_APP_URL` to it → Deployments → ⋯ → **Redeploy**.
3. **Settings → Deployment Protection:** keep **Vercel Authentication** enabled for **Preview** deployments. The production URL stays public; the app has its own login.
4. **Settings → Cron Jobs:** `/api/cron/daily` must be listed (from `vercel.json`). Press **Run** once after step 4 below.

### 3a. Production migrations (run once, from your PC)

Preferred, per the master guide:

```powershell
$env:DATABASE_URL = "<NEON_PROD_POOLED>"
$env:DIRECT_URL   = "<NEON_PROD_DIRECT>"
pnpm db:deploy                      # prisma migrate deploy
$env:NODE_ENV = "production"
pnpm db:seed                        # production seed = the Setting row ONLY (no fixtures)
Remove-Item Env:DATABASE_URL, Env:DIRECT_URL, Env:NODE_ENV
```

**If `pnpm db:deploy` fails with `P1001` (cannot reach database):** on the dev PC Prisma's Rust schema engine could not reach Neon while Node's `pg` could. Use the working alternative, which applies `prisma/migrations/*/migration.sql` with `pg` and records each in `_prisma_migrations` exactly like Prisma (so `prisma migrate deploy` still works later from CI):

```powershell
$env:DIRECT_URL = "<NEON_PROD_DIRECT>"   # db:migrate reads DIRECT_URL only
pnpm db:migrate
$env:DATABASE_URL = "<NEON_PROD_POOLED>"
$env:NODE_ENV = "production"
pnpm db:seed
Remove-Item Env:DATABASE_URL, Env:DIRECT_URL, Env:NODE_ENV
```

(`scripts/db-migrate.ts` always applies to the `public` schema outside test mode.) Note `.env.local` is loaded by `db:seed` only for variables NOT already set in the process, so the `$env:` values above win over your dev database.

### 3b. Verify the production schema (read-only)

```powershell
$env:DIRECT_URL = "<NEON_PROD_DIRECT>"
pnpm db:verify
Remove-Item Env:DIRECT_URL
```

Expected: every line `OK`, including tables (`Setting`, `Match`, `ScreeningRun`, `RunMatch`, `IngestToken`, `Credential`, `LoginAttempt`, `RateLimit`, `_prisma_migrations`), indexes `one_running_run` (unique partial index: only one RUNNING run), `Match_provider_providerMatchId_key`, `IngestToken_tokenHash_key`, the four `Setting_*_check` CHECK constraints, `migrations all finished 1/1`, and row counts `Setting=1 Match=0 ScreeningRun=0` (a fresh production has no fixture matches). Any `MISSING` → re-run section 3a; do not continue.

## 4. Post-deploy verification

Automated (run from the PC; the password and cron secret stay in this shell only):

```powershell
$env:BASE_URL = "https://<project>.vercel.app"
$env:EXPECT_HTTPS = "1"
$env:SMOKE_PASSWORD = "<production password>"      # enables login/cookie checks
# $env:CRON_SECRET = "<CRON_SECRET_PROD>"           # OPTIONAL: also triggers a real daily run
pnpm prod:smoke
Remove-Item Env:BASE_URL, Env:EXPECT_HTTPS, Env:SMOKE_PASSWORD -ErrorAction SilentlyContinue
```

Exit code 0 = all checks passed (SKIP lines are items it could not verify, never passes). It checks: `/` → `/login`, `/api/health` shape, security headers + HSTS on pages and API, `/style-guide*` 404, robots disallow, manifest/OG/icon public, signed-out API 401, cron 401 without/with wrong secret, login cookie flags.

Manual (master-guide table):

| Check | How | Expected |
|---|---|---|
| Login | open the URL in a private window | redirect to `/login`; log in with the production password |
| Health | `/api/health` | `{"ok":true,"db":true}` (signed out: only these two keys) |
| Cookie | DevTools → Application → Cookies | `__Host-session`, Secure, HttpOnly, SameSite=Lax |
| Headers | `curl.exe -I https://<url>/login` | `x-frame-options`, `x-content-type-options`, `content-security-policy`, `strict-transport-security`, `referrer-policy`, `permissions-policy` |
| Cron | Vercel → Cron Jobs → Run | a run appears in `/runs` (SKIPPED in push/C-lite mode, real in mode A) |
| Devices | phone on mobile data + desktop | works, responsive |
| Logs | Vercel → Logs | no errors |
| Isolation | Neon production → Tables | only the Setting row (+ runs) — no fixture matches |
| Previews | open a preview URL | asks for Vercel login; uses dev Neon (check its env) |
| Dev routes | `/style-guide` | 404 |

### Cron and time zones

`vercel.json`: `0 6 * * *` is **UTC**. In UK winter (GMT) that is 06:00; in summer (BST) it is 07:00 UK. Hobby plan = once per day, and the run may start any time inside that hour; "run hour" in Settings is informational (D7). Vercel Cron only runs on **Production** deployments and sends `Authorization: Bearer $CRON_SECRET` itself. Manual trigger from the PC: `Invoke-RestMethod -Headers @{Authorization="Bearer <CRON_SECRET_PROD>"} https://<url>/api/cron/daily`.

## 5. First real-data run (17.2)

Mode C-lite (default without PrediGoal permission):

1. Sign in to PrediGoal yourself (your own subscription, your own session — the app never sees those credentials).
2. For each match you want screened, copy the visible page text and paste it on `https://<url>/import` → *Page text* tab. Check the preview, fix any highlighted field, **Import**. (Or import a JSON/CSV file you created yourself.)
3. Open 10 sampled matches (mix of qualifying and non-qualifying) on PrediGoal and compare form %, win/draw/win, BTTS yes/no, over/under 2.5 and the predicted score with the app: they must be **identical** (100%); non-qualifying matches must be absent.
4. Check the acceptance example (e.g. Sporting Cristal 80% vs FC Cajamarca 7%) if one exists that day.
5. Check kickoff times in UK time against PrediGoal.
6. `/runs` shows the run, counts and no unexplained failures.

Mode B only with written permission: Settings → create an ingest token (shown once), install the userscript pointing at the production URL, click *Update data* on PrediGoal. Mode A only with an official key: set `PROVIDER_API_BASE`/`PROVIDER_API_KEY` in Production, redeploy, press Run in Vercel Cron.

## 6. Rollback

| Problem | Action |
|---|---|
| Bad deployment | Vercel → Deployments → pick the last good one → ⋯ → **Promote to Production** (instant, no rebuild). |
| Bad env value | fix it in Settings → Environment Variables → **Redeploy** (env changes apply only to new deployments). |
| Bad migration | Migrations here are additive and the production DB starts empty. Prefer: restore with Neon **Branches → Restore** (point-in-time) to a time before the migration, or create a new Neon branch and re-run 3a/3b against it, then update the two URLs and redeploy. Never edit `_prisma_migrations` by hand. |
| Cron misbehaving | Settings → Cron Jobs: disable it, or remove the entry from `vercel.json` and redeploy. A stuck run: the partial unique index `one_running_run` allows only one RUNNING run; if a run is stuck RUNNING, check /runs and the Vercel logs before triggering again. |
| Lost access / suspected leak | Rotate (section 7), then **Settings → Password** change bumps `sessionVersion` and signs out every session. |

## 7. Rotation of secrets and tokens

| Secret | How |
|---|---|
| Neon password | Neon console → Roles → Reset password → update Vercel `DATABASE_URL`/`DIRECT_URL` (both) → Redeploy → update `.env.local`. **Mandatory now (0.1).** |
| `SESSION_SECRET` | new value in Vercel → Redeploy. Everyone is signed out. |
| `CRON_SECRET` | new value in Vercel → Redeploy (Vercel Cron picks it up automatically). |
| App password | in the app: Settings → Password (needs the current one). Or generate a new `APP_PASSWORD_HASH` and redeploy (a Credential row set in the app wins over the env hash). |
| Ingest token (mode B) | Settings → revoke the token → create a new one → update the userscript. Tokens are shown once and stored hashed. |
| Vercel/GitHub/Neon account access | after handover, the owner removes any collaborators she does not recognise. |

## 8. Stop conditions

Do not proceed to the next section if: `pnpm db:verify` shows any MISSING, `prod:smoke` exits non-zero, the cookie is not `__Host-session` with Secure/HttpOnly/SameSite=Lax on the https URL, previews can reach the production database, or fixture matches appear in production.

## 9. Local rehearsal (already done, repeatable)

`pnpm build` then `pnpm exec next start -p 3017` with process-only throwaway secrets pointing at the isolated dev-database schema `test_deploy` (never production), then `pnpm prod:smoke`. Plain `http://localhost` caveat: the session cookie is `Secure`; Node-based checks read the `Set-Cookie` header directly, but browsers such as Safari may refuse to store it over http, so the stored-cookie check must be repeated by eye on the https URL.
