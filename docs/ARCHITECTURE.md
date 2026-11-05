# ARCHITECTURE.md (v2)

## 1. Principles
1. **Domain first:** screening is pure TypeScript (no Next/Prisma imports), exhaustively unit-tested.
2. **Providers are adapters** behind one interface; UI and domain never know which provider/mode produced data.
3. **Server Components by default;** Client Components only for interactivity/animation/polling. Keep client islands small.
4. **One shared shell:** `AppShell` is the only place nav/footer exist. No per-page copies.
5. **Validate at every boundary** with zod (env, API bodies, forms, URL params, ingest payloads).
6. **Secrets only in env,** validated at boot by `src/lib/env.ts`; never exposed to the client.
7. **Idempotent writes:** every ingestion path can be repeated safely.
8. **Fail soft:** failures never destroy previously stored good data.

## 2. Layers and allowed imports
```
app/ (routes, pages, route handlers)  ──▶  server/services  ──▶  server/repositories ──▶ lib/db (Prisma)
                                           │                      
components/ (UI)  ──▶ (props only; may call server actions / fetch via lib/fetcher)
server/domain  ◀── used by services only; imports NOTHING from app/, components/, prisma, next
server/providers ──▶ domain types + lib only
```
Enforced with ESLint `no-restricted-imports` (add in Step 0.5.2): components must not import `server/repositories` or Prisma; `server/domain` must not import `next/*`, `@prisma/client`, `react`.

## 3. Folder structure
```
football-screener/
├─ docs/                       # all project docs (agents read these) + reference/ images
├─ prisma/ schema.prisma · migrations/ · seed.ts
├─ public/ helper/ (userscript/bookmarklet assets) · icons/ · og.png
├─ scripts/ hash-password.ts · contrast.mjs · run-daily.ts
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx · globals.css · not-found.tsx · global-error.tsx · robots.ts
│  │  ├─ (auth)/login/page.tsx (+ loading.tsx)
│  │  ├─ (app)/
│  │  │  ├─ layout.tsx (AppShell + session guard) · template.tsx (PageTransition) · loading.tsx · error.tsx
│  │  │  ├─ page.tsx                       # dashboard
│  │  │  ├─ matches/[id]/{page,loading,error}.tsx
│  │  │  ├─ runs/{page,loading,error}.tsx
│  │  │  ├─ import/{page,loading,error}.tsx
│  │  │  └─ settings/{page,loading,error}.tsx
│  │  ├─ (dev)/style-guide/page.tsx         # dev-only, 404 in production
│  │  └─ api/
│  │     ├─ auth/login/route.ts · auth/logout/route.ts
│  │     ├─ cron/daily/route.ts
│  │     ├─ ingest/route.ts
│  │     ├─ import/route.ts                 # session-protected paste/upload
│  │     ├─ run/route.ts · runs/[id]/route.ts
│  │     ├─ settings/route.ts · settings/rescreen/route.ts · settings/password/route.ts
│  │     ├─ tokens/route.ts · tokens/[id]/route.ts
│  │     └─ health/route.ts
│  ├─ components/
│  │  ├─ ui/        (shadcn, themed)
│  │  ├─ layout/    AppShell Navbar MobileNav Footer PageContainer SectionHeader
│  │  ├─ match/     MatchCard FormBar FormBadges ProbabilityGrid QualifiesChip TeamLogo MatchFilters
│  │  ├─ runs/      RunStatusChip RunStatusPanel RunsTable RunDetailDialog
│  │  ├─ settings/  ThresholdForm ScheduleForm AccessModeForm TokenManager PasswordForm MaintenanceCard
│  │  ├─ import/    ImportPanel ImportPreview HelperInstructions
│  │  ├─ states/    PageSkeleton CardSkeleton TableSkeleton EmptyState ErrorState OfflineBanner StaleBanner SlowHint RouteProgress
│  │  ├─ motion/    Reveal Stagger PageTransition CountUp AnimatedBar PressableScale
│  │  └─ shared/    Logo Toaster
│  ├─ server/
│  │  ├─ domain/        types.ts screening.ts window.ts schema.ts normalize.ts
│  │  ├─ providers/     types.ts index.ts official-api.ts assisted-ingest.ts manual-import.ts
│  │  ├─ services/      run-service.ts match-service.ts settings-service.ts token-service.ts auth-service.ts
│  │  ├─ repositories/  settings.ts matches.ts runs.ts tokens.ts login-attempts.ts credentials.ts rate-limits.ts
│  │  ├─ auth/          session.ts password.ts rate-limit.ts guard.ts
│  │  └─ errors.ts      AppError + codes
│  ├─ lib/ db.ts env.ts utils.ts time.ts constants.ts fetcher.ts motion.ts logger.ts
│  ├─ hooks/ useOnlineStatus.ts useSlowRequest.ts useRunPolling.ts
│  ├─ types/
│  └─ middleware.ts   (proxy.ts if the installed Next version renamed it)
├─ tests/ unit/ integration/ e2e/ fixtures/ (matches.json, predigoal/…)
├─ .env.example · .gitignore · vercel.json · next.config.ts · components.json
└─ README.md
```

## 4. Database (Prisma, Neon Postgres)
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL"); directUrl = env("DIRECT_URL") }
// NOTE: follow the installed Prisma version's current docs (v7 uses prisma.config.ts and driver adapters,
// e.g. @prisma/adapter-neon). Runtime = pooled URL; migrations = direct URL.

enum AccessMode  { official_api assisted_ingest manual_import }
enum FormScope   { league overall }
enum RunStatus   { RUNNING SUCCESS PARTIAL FAILED SKIPPED }
enum RunTrigger  { CRON MANUAL INGEST IMPORT }
enum Side        { HOME AWAY }
enum Confidence  { LOW MEDIUM HIGH }

model Setting {                       // singleton: id = 1
  id             Int        @id @default(1)
  highThreshold  Int        @default(75)
  lowThreshold   Int        @default(35)
  windowDays     Int        @default(2)            // 1 | 2 (app-validated)
  formScope      FormScope  @default(league)
  timezone       String     @default("Europe/London")
  runHourLocal   Int        @default(7)            // informational on Vercel Hobby
  accessMode     AccessMode @default(manual_import)
  staleAfterHrs  Int        @default(26)
  sessionVersion Int        @default(1)            // bump to invalidate all sessions
  updatedAt      DateTime   @updatedAt
}

model Credential {                    // optional override of env password hash (set on password change)
  id           Int      @id @default(1)
  passwordHash String
  updatedAt    DateTime @updatedAt
}

model Match {
  id              String      @id @default(cuid())
  provider        String
  providerMatchId String
  sourceUrl       String?
  kickoffAt       DateTime
  league          String?
  country         String?
  homeName        String
  awayName        String
  homeLogoUrl     String?
  awayLogoUrl     String?
  homeFormPct     Float
  awayFormPct     Float
  formScope       FormScope
  homeLastResults String?                           // e.g. "WDD" (≤5 chars of W/D/L)
  awayLastResults String?
  pHomeWin        Float?
  pDraw           Float?
  pAwayWin        Float?
  pBtts           Float?                            // probability of "Yes" (No = 100 − pBtts, derived for display)
  pOver25         Float?                            // probability of "Over 2.5" (Under = 100 − pOver25, derived)
  predHomeGoals   Int?                              // source's predicted score, e.g. 3
  predAwayGoals   Int?                              // e.g. 1 (both null when the source gives none)
  confidence      Confidence?
  qualifies       Boolean     @default(false)
  strongSide      Side?
  formGap         Float       @default(0)           // |home - away|, always computed (even when not qualifying)
  firstRunId      String?
  lastRunId       String?
  fetchedAt       DateTime
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  runs            RunMatch[]
  @@unique([provider, providerMatchId])
  @@index([kickoffAt])
  @@index([qualifies, kickoffAt])
}

model ScreeningRun {
  id          String     @id @default(cuid())
  trigger     RunTrigger
  provider    String
  status      RunStatus
  startedAt   DateTime   @default(now())
  finishedAt  DateTime?
  windowFrom  DateTime?
  windowTo    DateTime?
  scanned     Int        @default(0)
  qualified   Int        @default(0)
  failedCount Int        @default(0)
  error       String?                                // human-readable summary
  details     Json?                                  // per-item failures [{index,id,reason}]
  matches     RunMatch[]
  @@index([startedAt])
  @@index([status, startedAt])
}
// Concurrency guard: add in the migration SQL a partial unique index so only ONE run can be RUNNING:
//   CREATE UNIQUE INDEX one_running_run ON "ScreeningRun" ((status)) WHERE status = 'RUNNING';

model RunMatch {
  runId          String
  matchId        String
  qualifiedAtRun Boolean
  run   ScreeningRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  match Match        @relation(fields: [matchId], references: [id], onDelete: Cascade)
  @@id([runId, matchId])
}

model IngestToken {
  id         String    @id @default(cuid())
  label      String
  tokenHash  String    @unique                      // sha256 hex of the plaintext
  createdAt  DateTime  @default(now())
  lastUsedAt DateTime?
  revokedAt  DateTime?
}

model LoginAttempt {                  // rate limiting + audit; purge > 30 days
  id      String   @id @default(cuid())
  ip      String
  at      DateTime @default(now())
  success Boolean
  @@index([ip, at])
}

model RateLimit {                     // generic fixed-window counter (ingest per token, etc.)
  key         String   @id             // e.g. "ingest:<tokenId>:2026-11-03T14"
  count       Int      @default(0)
  windowStart DateTime
  @@index([windowStart])
}
```
Schema notes: `highThreshold`/`lowThreshold`/`windowDays`/`runHourLocal`/`staleAfterHrs` ranges are enforced in zod (DB has no CHECK unless added in migration SQL — add `CHECK (lowThreshold < highThreshold AND lowThreshold >= 0 AND highThreshold <= 100)` and `CHECK (windowDays IN (1,2))` in the init migration for defence in depth). `cuid()` ids are not meaningful to the client; the URL `/matches/[id]` uses `Match.id`. `Match` rows are retained 90 days after `kickoffAt` (not after creation) so history never disappears early. Only the **hash** of tokens is stored; PrediGoal credentials are never stored; purge `LoginAttempt`/`RateLimit` older than 30 days/2 days in the daily cron. Use `$transaction` for `processBatch` writes and for re-screen.

## 5. Provider interface
```ts
type AccessModeKey = 'official_api' | 'assisted_ingest' | 'manual_import'
interface MatchProvider {
  key: AccessModeKey
  canPull: boolean
  fetchWindow?(range: { from: Date; to: Date }, ctx: { settings: Setting; signal: AbortSignal }): Promise<RawMatchInput[]>
}
normalizePayload(input: unknown): { valid: RawMatchInput[]; invalid: { index: number; id?: string; reason: string }[] }
```
Push providers (B, C) only validate/normalize; pull provider (A) fetches with timeout 20s, max 2 retries, polite concurrency 1.

## 6. Run pipeline (sequence)
```
trigger ──▶ run-service.start(trigger)
   1. expire abandoned runs: UPDATE runs SET status=FAILED,error='timed out' WHERE status=RUNNING AND startedAt < now()-10min
   2. insert RUNNING row (partial unique index rejects a 2nd → return the existing runId, HTTP 202)
  providerData | payload ──▶ normalizePayload ──▶ formScope check vs Setting ──▶ evaluateMatch (domain)
  ──▶ $transaction{ upsert Match (fetchedAt = server now), upsert RunMatch }
  ──▶ finish(status, scanned, qualified, failedCount, error, details)
on exception: finish(FAILED, error) — the transaction rolls back, earlier Match rows untouched
```
Status rules: all items stored → SUCCESS · some invalid, others stored → PARTIAL · none stored (provider/DB failure or every item invalid) → FAILED. `finish()` must itself be wrapped so a failure to write the status never leaves the run RUNNING forever (recovery in step 1 covers hard crashes).
Vercel limits: set `export const maxDuration = 60` on `/api/run`, `/api/cron/daily`, `/api/ingest`, `/api/import` (Hobby default is 10s without it; check the current plan limit). Keep batches ≤ 500 and queries batched (`createMany`/chunked upserts of ≤ 100) so a run stays well under the limit.

## 7. API catalogue
| Route | Method | Auth | Body → Response |
|---|---|---|---|
| `/api/auth/login` | POST | none (rate-limited) | `{password}` → 204 + cookie / 401 / 429 |
| `/api/auth/logout` | POST | session | – → 204 |
| `/api/cron/daily` | GET | `Bearer CRON_SECRET` | – → `{runId,status}` |
| `/api/ingest` | POST | `Bearer <token>` | `{matches: RawMatchInput[]}` (≤500, ≤1MB) → `{runId,scanned,qualified,failed}` |
| `/api/import` | POST | session | same payload → same response |
| `/api/run` | POST | session | – → 202 `{runId}` (409 if mode can't pull) |
| `/api/runs/[id]` | GET | session | → run + counts |
| `/api/settings` | GET/PUT | session | settings zod schema → settings |
| `/api/settings/rescreen` | POST | session | – → `{changed, qualifies}` |
| `/api/settings/password` | POST | session | `{current,new}` → 204 (bumps `sessionVersion`) |
| `/api/tokens` | GET/POST | session | create → `{id,label,token(plaintext once)}` |
| `/api/tokens/[id]` | DELETE | session | revoke |
| `/api/health` | GET | none (minimal) / session (detailed) | public: `{ok,db}`; with a valid session also `{lastRunAt,lastStatus}`. Never secrets, never counts of data. |
Error body: `{ error: { code, message, fieldErrors? } }`. Codes: `UNAUTHORIZED, VALIDATION_FAILED, RATE_LIMITED, PAYLOAD_TOO_LARGE, MODE_NOT_SUPPORTED, PROVIDER_NOT_CONFIGURED, RUN_IN_PROGRESS, NOT_FOUND, INTERNAL`.
CORS: `/api/ingest` only, allow-list from `INGEST_ALLOWED_ORIGINS` (exact-match origins, never `*`, never reflect arbitrary Origin); `Access-Control-Allow-Headers: authorization, content-type`; no credentials; `OPTIONS` handled. **Note:** CORS only matters for in-page requests (bookmarklet). The preferred userscript uses `GM_xmlhttpRequest`, which bypasses both CORS and PrediGoal's CSP (see ApplicationFlow §6.4, D8). A bookmarklet may be blocked by PrediGoal's `connect-src` CSP — verify in recon before promising it. Requests with a missing/invalid `Origin` but a valid token (userscript, curl) are allowed; the token is the credential.

## 8. Environment variables
| Var | Required | Scope | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | server | Neon **pooled** |
| `DIRECT_URL` | yes | migrations | Neon **direct** |
| `SESSION_SECRET` | yes | server | ≥ 32 chars |
| `APP_PASSWORD_HASH` | yes* | server | bcrypt; *overridden by `Credential` row once password changed* (quote with single quotes locally) |
| `CRON_SECRET` | yes | server | Vercel sends as Bearer to cron |
| `NEXT_PUBLIC_APP_URL` | yes | public | canonical URL |
| `INGEST_ALLOWED_ORIGINS` | yes | server | comma list; default `https://predigoal.com` |
| `PROVIDER_API_BASE` / `PROVIDER_API_KEY` | mode A only | server | only if official access granted |
| `DATABASE_URL_TEST` | tests | local/CI | Neon branch `test` |
| `LOG_LEVEL` | no | server | `info` default |
Never prefix secrets with `NEXT_PUBLIC_`.

## 9. Security architecture
Session: JWT (HS256, `jose`) in an httpOnly, SameSite=Lax, Path=/ cookie, 30 days; claims `{ v: sessionVersion, iat, exp }`. Cookie name = `__Host-session` **in production** (requires Secure) and plain `session` in local dev (`http://localhost` can't set `__Host-`/Secure cookies in all browsers, e.g. Safari) — pick via `NODE_ENV`.
**Two-tier verification (important):** `middleware.ts` runs on the Edge runtime (no Prisma, no bcrypt, no DB). It therefore only checks JWT **signature + expiry** (via `jose`) and redirects unauthenticated users. The **`sessionVersion` check requires the DB**, so it runs in Node: in `(app)/layout.tsx` via `requireSession()` (server/auth/guard.ts) and in every session-protected route handler. A version mismatch clears the cookie and redirects to `/login`. This is what makes "change password logs out other sessions" actually work. Middleware `matcher` excludes `_next/static`, `_next/image`, `favicon`, `robots`, public assets and the public API routes listed in FR8. Passwords bcrypt cost 12. Rate limits: login 5/15min/IP; ingest 30/hour/token (RateLimit table). Timing-safe comparisons for secrets. CSRF: SameSite=Lax + JSON-only mutating endpoints + Origin check on mutating session routes. Headers (`next.config`): `Content-Security-Policy` (default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' (tighten with nonces if feasible); connect-src 'self'; frame-ancestors 'none'), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, HSTS (Vercel). `robots` noindex. Logs never contain tokens/passwords/payload bodies.

## 10. Caching, performance, images
Authenticated pages are dynamic (no shared cache); `Cache-Control: private, no-store` on API responses with user data. Settings cached per-request. Dashboard query uses `(qualifies, kickoffAt)` index; cap 200 rows. `next/image` with `remotePatterns` for team-logo hosts discovered in recon (fallback initials). Dynamic-import GSAP. Fonts via `next/font` (self-hosted).

## 11. Observability
`/api/health`; structured logger (`lib/logger.ts`, JSON in prod); every failed run stores a readable `error`; Vercel logs; optional Vercel Analytics. Runbook documents diagnosis.

## 12. Deployment
`vercel.json`:
```json
{ "crons": [{ "path": "/api/cron/daily", "schedule": "0 6 * * *" }] }
```
Hobby = one cron/day, ±1h. Previews use a separate Neon branch. Migrations: `prisma migrate deploy` run manually (or in a build command if desired). Production seed: Setting row only.

## 13. Testing architecture
Unit (domain, normalizers, auth utils) · integration (repositories/services against Neon `test` branch, reset per suite) · component (RTL) · e2e (Playwright: 4 projects mobile/tablet/desktop/wide) · a11y (axe) · network-state tests (MSW/offline/slow) · contract tests for `/api/ingest`. Coverage gates: domain ≥ 95%, services ≥ 85%.
