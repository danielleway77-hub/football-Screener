# PRODUCTION_READINESS.md

Honest scorecard on branch `prod-standards`. PASS = implemented and evidenced; PARTIAL = works with a stated gap; TODO = not done. Nothing here was deployed or run against real accounts.

## Security
| Item | Status | Evidence |
|---|---|---|
| Auth on every route, guarded by inventory test | PASS | `tests/unit/route-inventory.test.ts`, `src/proxy.ts`, `requireOwner` |
| Security headers (CSP, HSTS in prod, nosniff, frame deny) | PASS | `src/lib/security-headers.ts`, `tests/unit/security-headers.test.ts` |
| Framework not advertised | PASS | `poweredByHeader: false`, `tests/unit/next-config.test.ts` |
| Secrets never in repo or logs | PASS | `pnpm secret-scan` (CI job), logger redaction `tests/unit/logger.test.ts` |
| `robots` disallow all | PASS | `src/app/robots.ts` |
| Dependency advisories | PARTIAL | `pnpm audit`: high lodash fixed via `overrides` (4.18.1); left: 1 moderate minimatch (shadcn/ts-morph, dev tooling) and 1 low deepmerge (no patched release). Neither ships to the browser or the server runtime. |
| CSP without `unsafe-inline` | TODO | needs nonces, which force dynamic rendering (see security-headers.ts note) |

## Reliability
| Item | Status | Evidence |
|---|---|---|
| Pool limits and timeouts | PASS | `POOL` in `src/lib/db.ts` (max 5, idle 10 s, connect 5 s, query 20 s, statement 15 s on direct URLs); ARCHITECTURE "Database resilience" |
| Read-only retry-once on transient errors | PASS | `src/lib/db-retry.ts`; policy test forbids it in write functions (`tests/unit/db-resilience.test.ts`) |
| Graceful health check | PASS | `src/server/repositories/health.ts` (timeout, no throw, timer cleared) |
| Idempotent ingest and cron | PASS | `tests/integration/api.test.ts` (same payload twice), cron recent-run shortcut |
| Idle pool `error` event handler | TODO | the adapter hides the pool; revisit when Prisma exposes it |

## Observability
| Item | Status | Evidence |
|---|---|---|
| Structured JSON logs, levels, redaction | PASS | `src/lib/logger.ts`; no `console.*` left in `src/server`, `src/app/api` |
| Request id on every response, in error bodies and logs | PASS | `src/proxy.ts`, `handle()` in `src/server/http.ts`, `tests/unit/request-id.test.ts` |
| Metrics, tracing, alerting | TODO | none; rely on Vercel logs and `/api/health` |

## Performance
| Item | Status | Evidence |
|---|---|---|
| Compression, static asset cache headers | PASS | `compress: true`; `src/lib/cache-headers.ts` (1 day + SWR for unhashed `/public`; `_next/static` immutable by Next) |
| First-load JS budget (200 KB gz) | TODO | measured `route-bundle-stats.json`, gzip: `/` 334, `/settings` 346, `/import` 326, `/runs` 322, `/login` 280, `/matches/[id]` 282 KB. Even `/_not-found` is 230 KB, so the React 19 + Next client runtime (about 190-200 KB, chunks of 72/47/43 KB) alone nearly fills the budget; app code adds roughly 50-115 KB per route (zod 30 KB, lucide 16 KB, sonner 10 KB, date-fns 9 KB in shared or page chunks). `optimizePackageImports` was tested: bundle byte-identical (Turbopack already tree-shakes barrels), so not configured. Plan after the UI branches merge: framer-motion `LazyMotion` + `m` components, load GSAP and the login entrance dynamically, replace `zod` in client forms with `zod/mini`, lazy-load the run detail dialog. Realistic target 280-300 KB for the heaviest pages; 200 KB is not reachable without dropping the framework runtime. All of these touch component files. |

## Data
| Item | Status | Evidence |
|---|---|---|
| Old matches cascade their `RunMatch` rows | PASS | `tests/integration/database.test.ts`, `run-service.test.ts` ("cleanup - run history retention") |
| Run history retention 365 days, RUNNING kept, idempotent | PASS | `runs.deleteFinishedOlderThan`, `RETENTION_DAYS`, same test |
| Backups and restore drill | PARTIAL | Neon point-in-time restore documented in RUNBOOK section 6; never exercised |
| Migrations versioned and verified | PASS | `prisma/migrations`, `pnpm db:verify` |

## Ops
| Item | Status | Evidence |
|---|---|---|
| CI workflow file | PARTIAL | `.github/workflows/ci.yml` (format, typegen, lint, tsc, unit tests under UTC and Asia/Karachi, build with generated throw-away secrets, secret scan, advisory audit; integration and e2e by manual dispatch, secret names only). Written, **never run** (not pushed, not enabled); YAML not validated by GitHub. |
| Dependabot | PASS (file only) | `.github/dependabot.yml` weekly npm, monthly actions, framework majors ignored |
| Runbooks | PASS | RUNBOOK, DEPLOYMENT_RUNBOOK (log and request id section added) |
| Real deployment, Lighthouse, cross-browser | TODO | deliberately skipped (manual step) |

## Testing
| Item | Status | Evidence |
|---|---|---|
| Unit and component tests | PASS | `npx vitest run --project node --project dom`: 538 passed (45 files) |
| Integration (real Postgres, isolated schema) | PARTIAL | files touched by this branch run green individually; the full suite is slow (api.test.ts alone about 275 s on the remote DB) so it was run by file, not in one go |
| Timezone matrix | PARTIAL | `pnpm test:tz` exists and CI runs it; locally this branch ran the default TZ only |
| Client-rule regression (strict thresholds, window, No/Under) | PASS | `tests/unit/domain/client-rule.test.ts` plus existing screening/window/api tests |
| E2E | TODO for this branch | not run (UI files out of scope) |

## Docs
| Item | Status | Evidence |
|---|---|---|
| Architecture, runbook, standards updated | PASS | ARCHITECTURE "Observability and database resilience", "Data lifecycle and retention"; RUNBOOK sections 5 and 10 |
| Coding standard "no unused deps" | PASS | depcheck run; removed clsx, tailwind-merge, next-themes (kept: cross-env and @prisma/client are false positives, `tw-animate-css` and `shadcn` are CSS imports) |
