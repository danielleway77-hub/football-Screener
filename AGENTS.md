<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md â€” rules for any AI coding agent on this project (v2)

> Save copies as `CLAUDE.md` (Claude Code), `.cursorrules` (Cursor), `.github/copilot-instructions.md` (Copilot), or `AGENTS.md` (Codex) â€” same content.

## Mission
Build the **Football Match Screener**: a premium, responsive, single-user dashboard that screens PrediGoal fixtures 1â€“2 days ahead (one team's form > 75% and the other's < 35%) and shows, as in PrediGoal's "Exact probabilities" panel: win home / draw / win away, both-teams-to-score Yes/No, over/under 2.5 goals Over/Under, and the predicted score when available. Full definition: `docs/PROJECT_SCOPE.md`.

## Start of every session (mandatory)
1. Read `docs/PROJECT_STATE.md` â†’ know the current step, decisions, blockers.
2. Read the docs it lists, in order. Look at `docs/reference/*.png` when touching UI or data fields.
3. Confirm in 3 lines what you will do. Work **only** on the current step unless told otherwise.

## Source-of-truth map
| Question | File |
|---|---|
| What are we building / what's out of scope? | `PROJECT_SCOPE.md` |
| How should it behave (flows, states, rules)? | `ApplicationFlow.md` |
| Where does code go / DB / API / env? | `ARCHITECTURE.md` |
| How does it look and move (colours, type, components, motion tokens)? | `ThemeGuideline.md` |
| What does each screen look like, where does everything go, exact sizes, copy, formatting, interactions, QA rubric? | `UI_BLUEPRINT.md` |
| How do I write code? | `CODING_STANDARDS.md` |
| Does this component already exist? | `COMPONENT_REGISTRY.md` |
| How do I test / what counts as done? | `TESTING_STANDARDS.md` |
| Which exact tests must this step include? | `TEST_CATALOG.md` (Â§ = step id) |
| Where do I record test evidence? | `TEST_LOG.md` |
| What's done / next / blocked? | `PROJECT_STATE.md` |
If two docs conflict or something is ambiguous: **stop and ask**; do not invent client requirements. Propose the doc fix after the answer.

## Working protocol (applies to EVERY task â€” master-guide prompts refer to this section)
1. **ORIENT** â€” read `PROJECT_STATE.md` and the docs the prompt names; run `git status`; run `pnpm lint; pnpm typecheck; pnpm test` to confirm the previous step is still green. If it is red, STOP and report (don't build on red).
2. **EXPLORE** â€” search the repo (`rg`/Grep) for existing components, helpers and tests before creating anything; read the official docs for the INSTALLED versions of Next/Tailwind/Prisma/shadcn/date-fns-tz. Never invent an API from memory.
3. **PLAN** â€” output a plan of â‰¤ 12 lines: files to create/modify, tests to write (from `docs/TEST_CATALOG.md` Â§<step id>), risks. Continue without waiting unless a STOP condition applies.
4. **TESTS FIRST** â€” implement the step's catalog tests (domain, services, auth, API: write them first and watch them fail for the right reason; UI: write the layout/behaviour assertions with the component). Add more tests when you see more risk; never fewer than the catalog.
5. **IMPLEMENT** in small, reviewable commits (Conventional Commits) on the step branch.
6. **VERIFY** â€” run `pnpm lint; pnpm typecheck; pnpm test`, plus `pnpm e2e` for flows/UI and `pnpm build`; for UI capture screenshots at 360/768/1280/1920 and check the state matrix; for critical logic do a **mutation check**: make one deliberate small change (e.g. `>` â†’ `>=`, remove a transaction, drop a guard), confirm a test FAILS, then revert it.
7. **LOG** â€” append the evidence block to `docs/TEST_LOG.md` (real command results, counts, screenshot paths); update `PROJECT_STATE.md` and `COMPONENT_REGISTRY.md`.
8. **REPORT** â€” Done Â· Files changed Â· Tests (counts + outputs) Â· Evidence paths Â· Deviations from the spec (and why) Â· Risks/open questions Â· Next step.
**STOP and ask the owner when:** a requirement is ambiguous or two docs conflict Â· a needed account/secret/file is missing Â· the change would exceed the step's scope Â· a test can only pass by weakening it Â· permission/terms of an external site are unclear Â· a destructive or production action is needed Â· the same failure persists after two different attempts Â· the installed library version differs from what the docs assume.
**Never:** weaken, delete, skip (`.skip`, `.only`, `todo`) or loosen tests/coverage thresholds to get green Â· hide errors with empty `catch` Â· say "tested" without showing output Â· mock the unit under test Â· leave failing tests "for later" Â· change specs silently (report deviations).
**Test quality rules:** names describe behaviour ("does not qualify at exactly 75/35") Â· deterministic (frozen clock `2026-11-03T12:00:00Z`, seeded data, no sleeps â€” wait on locators/network) Â· UI tests assert what a user sees (roles, text, sizes) not implementation details Â· every bug fix adds a regression test Â· tests never touch dev/production databases.

## Environment notes
- Developer machine is **Windows 11 + PowerShell** (also Git Bash). Give PowerShell-compatible commands (no `&&` in Windows PowerShell 5.1; use `;` or separate lines). Paths in docs use `/`; scripts must work cross-platform (use `cross-env`/Node scripts, not bash-only syntax).
- Use **pnpm**. Verify installed versions (`package.json`) and consult the official docs for those versions before using Next/Tailwind/Prisma/shadcn APIs â€” do not rely on memory (see `CODING_STANDARDS.md` Â§12).
- Database: Neon is ONE database for development (schema `public`); automated tests use the isolated schema `test` and may wipe it; production will be a SEPARATE database/project created at deployment/handover. **Never run migrations/seeds/destructive scripts against production** unless the master guide step says so and the user confirms. Tests must assert they are not connected to dev/production.

## Always
1. Follow `ThemeGuideline.md` for **all** UI (tokens only; fonts, colours, spacing, radii, motion) and build to the wireframes, sizes and copy in `UI_BLUEPRINT.md` (read the section for the screen/component first). Add missing tokens to the theme file first; deviations from the blueprint need the owner's approval. After any UI work, produce screenshots at 360/768/1280/1920 and score the screen with the blueprint's Â§17 rubric.
2. Reuse components; check `COMPONENT_REGISTRY.md` before creating any. One Navbar/Footer/AppShell; never duplicate layout/markup per page.
3. Every async view ships with loading skeleton, empty, error + retry, and works offline/slow (see `ApplicationFlow.md` Â§9).
4. Verify every UI change at 360, 768, 1280, 1920 px; keyboard-only; reduced-motion.
5. Colour is never the only signal (W/D/L letters, â†‘/â†“ icons, labels).
6. Validate all external input with zod; keep business logic in `server/domain` + `server/services`; Prisma only in repositories.
7. Write/adjust tests with the code; run `pnpm lint && pnpm typecheck && pnpm test` (and `pnpm e2e` for flows) before saying "done".
8. After finishing: update `PROJECT_STATE.md` (status, decisions, blockers, next), `COMPONENT_REGISTRY.md`, and any doc whose truth changed.
9. Keep diffs focused; small commits with Conventional Commit messages on the step branch.

## Never
- Never store, log, hard-code, or commit third-party credentials (PrediGoal, Whop, Google) or any secret. Never put secrets in `NEXT_PUBLIC_*`.
- Never bypass login, 2FA/access codes, paywalls, captchas, or rate limits of any external site; never hammer an external site (â‰¥ 1 s between requests, 1 concurrent).
- Never use `any`, `@ts-ignore`, empty `catch`, `console.log`, dead code, or hard-coded hex/px values outside the theme.
- Never put business rules in React components or route handlers.
- Never add features outside scope â€” log them in `PROJECT_STATE.md` Â§11 as "proposed".
- Never present betting advice, tips, or "sure win" language in the UI.
- Never delete user data or run destructive DB commands without explicit instruction.

## Product invariants (do not break)
- Rule: `qualifies = (home > high && away < low) || (away > high && home < low)`; defaults 75/35; strict inequalities.
- Missing data is `null` and shows "Unavailable" â€” never 0. Ambiguous input (naive timestamps, bare fractions, wrong form scope) is **rejected with a reason**, never guessed.
- `proxy.ts` (Next 16 name for middleware) only verifies the JWT signature/expiry â€” keep it thin and stateless, no DB; the session-version check happens in Node (`requireSession()`).
- Dashboard shows qualifying matches with `kickoffAt >= now`; the 1â€“2 day window only governs what is fetched/screened.
- Failed runs never alter stored data; ingestion is idempotent; only one RUNNING run at a time.
- Times stored in UTC, displayed in the owner's timezone; "tomorrow" is computed in that timezone.
- Single owner; all routes protected except `/login`, `/api/auth/*`, `/api/health`; cron/ingest use their own secrets.

## Definition of done (per step)
Code + tests green + responsive matrix + state matrix + a11y quick pass + bug-and-gap hunt clean (0 open P0â€“P2) + docs updated + committed.

## Reporting format (end of each task)
**Done:** â€¦ Â· **Files changed:** â€¦ Â· **Tests run (result):** â€¦ Â· **Responsive/a11y checked:** â€¦ Â· **Risks/open questions:** â€¦ Â· **Next step:** â€¦

## When stuck
State what you tried, the exact error, and 2 options with trade-offs. Don't loop on the same failing approach more than twice.
