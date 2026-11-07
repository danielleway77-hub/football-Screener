# Pipeline checkpoint (read this first when resuming after a usage limit / restart)

Last updated: 2026-11-07 (session ended on the 5-hour limit risk). Main project: `D:\WEB DEV\Daniel\football-screener` (branch `master`, last commit at write time `030c0e2`). The user wants ONE final folder only: after everything is merged, delete all `football-screener-*` worktree folders and their branches.

## Done and merged to master

Steps 0-16 (foundation, DB, auth, domain, providers/run service, ingest/import/run/health/token APIs, cron, dashboard, match detail + FormDuel, runs page, settings + import, resilience, polish, hardening), Step 17 PREPARATION (runbook, prod:smoke, db:verify; real deploy is MANUAL and skipped), UI polish merged for: login + 404/error, settings, runs, match detail; handover docs (README, RUNBOOK, USER_GUIDE, HANDOVER_CHECKLIST, CHANGELOG).
Gates at last merge: tsc/eslint clean, build OK, vitest node+dom 502 passed.

## In flight (worktrees; agents may be stopped by a limit; resume with SendMessage to the agent id, or start a fresh agent that reads the branch state)

| Work | Branch / worktree | Agent id | State |
|---|---|---|---|
| Dashboard UI elevation | `ui-dashboard` / `..\football-screener-ui-dashboard` | a886884a27042dd13 | commits through 7df43ed (empty states, stale rail, card depth, stagger, skeleton); still needs clean desktop+mobile spec run, sleek checks, screenshots viewed, then MERGE to master |
| Import UI elevation | `ui-import` / `..\football-screener-ui-import` | af2e870439647d561 | commits through 0884512; needs final spec runs (desktop then mobile), sleek import entry, then MERGE |
| Whole-project functionality audit (+ client-idea fit) | `audit-functional` / `..\football-screener-audit` | adb36500076aac344 | 17 uncommitted files at checkpoint; produces `docs/FUNCTIONAL_AUDIT.md`; fixes real bugs; then MERGE |

## Remaining after the above

1. Merge each branch into master (resolve conflicts keeping both sides; TEST_LOG/PROJECT_STATE conflicts: keep both). After each merge: `npx next typegen`, tsc, eslint, `npx vitest run --project node --project dom`.
2. Fix everything FUNCTIONAL_AUDIT.md lists as GAP/real bug.
3. Optional hardening leftovers: JS bundle budget (first load ~310-365 KB gz vs 200 KB; LazyMotion/framer trim), `pnpm audit` 1 high transitive dev-only, Lighthouse + cross-browser not run, sleek check final pass counts for settings/import.
4. Final full run on merged master: `pnpm test:tz` (UTC + Asia/Karachi), integration suite (isolated `test_<name>` schema, never at the same time as e2e), Playwright ONE project at a time (desktop, mobile, tablet, wide) with `--workers=1`, `pnpm build`, `pnpm prod:smoke`, `pnpm secret-scan`, `pnpm contrast`.
5. Update docs/PROJECT_STATE.md and HANDOVER_CHECKLIST (mark Step 18 audits; restore the claim that Back keeps dashboard filters, it is implemented via `?from=`); verify the unverified statements flagged by the docs agent (password-recovery SQL step, retention wording).
6. Cleanup: remove worktrees `..\football-screener-audit`, `-ui-dashboard`, `-ui-import` and the stuck `..\football-screener-ui-settings` folder (path too long: use `cmd /c rmdir /s /q` or `robocopy` empty-dir trick), `git worktree prune`, delete merged branches. Leave only `football-screener`.

## Manual items for the owner (cannot be automated)

Deploy to Vercel (17.1) and first real-data run (17.2); rotate the Neon password that was pasted in chat; set the production password hash; PrediGoal written permission (gate G2/D17) for automatic modes (until then the delivered path is Import/paste); real-device check (15.3).

## Operating rules (saved in memory `autonomous-pipeline-mode`)

User is away; never ask permission questions. Do not push or deploy. RAM is limited: heavy Playwright runs ONE project at a time; keep at most ~4 agents running. Windows: Python is not installed (use node scripts); bash heredocs containing quotes can break, prefer the Write tool; Prisma schema engine cannot reach Neon from this PC (use `pnpm db:migrate`); `.env.local` hash needs `\$` escapes; integration/e2e schemas must match `test_[a-z0-9]+` (no second underscore).

## STOPPED BY THE USER (2026-11-07): all agents were stopped on purpose

The user stopped every agent and will resume with a new account. Work-in-progress in the three worktrees was committed as `wip: checkpoint before agents were stopped` (ui-dashboard, ui-import, audit-functional), so nothing is lost. To resume: start FRESH agents (the old ids are dead) on the existing worktrees/branches, with the briefs in this file's table; ui-dashboard and ui-import then merge into master; audit-functional finishes `docs/FUNCTIONAL_AUDIT.md` (incl. the 'Client idea fit' section: read D:\WEB DEV\Daniel\Refrence\*, verify the golden example end to end); then follow 'Remaining after the above'.
