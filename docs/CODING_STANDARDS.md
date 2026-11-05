# CODING_STANDARDS.md (v2)

## 1. Language and tooling
1. **TypeScript strict** (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`). No `any`; use `unknown` + zod. No `@ts-ignore` (use `@ts-expect-error` with a reason comment).
2. ESLint (next + typescript-eslint + `no-restricted-imports` layer rules) and Prettier (tailwind plugin) must pass: `pnpm lint && pnpm typecheck && pnpm test` before every commit.
3. Package manager: **pnpm** only. Pin major versions; commit the lockfile. No unused dependencies (`pnpm dlx depcheck` at Step 16).

## 2. Naming and files
| Item | Convention | Example |
|---|---|---|
| Components | PascalCase file = component name | `MatchCard.tsx` |
| Hooks | `useX` camelCase | `useRunPolling.ts` |
| Utilities/services/repos | kebab-case files, camelCase exports | `run-service.ts` → `startRun()` |
| Constants | UPPER_SNAKE | `STALE_AFTER_HOURS_DEFAULT` |
| Types/interfaces | PascalCase, no `I` prefix | `RawMatchInput` |
| Zod schemas | `xyzSchema` + inferred `Xyz` type | `ingestPayloadSchema` |
| Booleans | `is/has/can/should` | `canPull` |
| Test files | `*.test.ts(x)` next to or under `tests/` mirroring path | |
One component per file. Absolute imports via `@/`. Barrel `index.ts` only inside `components/<group>/`.

## 3. Architecture rules (see ARCHITECTURE.md §2)
- Domain code is pure; services orchestrate; repositories are the **only** Prisma users; components never touch the DB.
- Route handlers are thin: parse (zod) → call service → map result/`AppError` to HTTP.
- Business rules (thresholds, windows, status transitions) never live in React components or route handlers.

## 4. React / Next
- Server Components by default; add `"use client"` only for state, effects, event handlers, browser APIs, animation. Push the boundary as low as possible.
- Data fetching in Server Components/services; client fetches go through `lib/fetcher.ts` (timeout, retry for idempotent GET, typed errors).
- Keys stable (ids not indexes). No derived state stored in state. Memoize only when measured.
- Forms: react-hook-form + zod resolver; shared schemas between client and server; labels, errors via `aria-describedby`; disabled + spinner while submitting; never lose user input on error.
- URL is the source of truth for filters (`searchParams`, validated with zod).
- No `useEffect` for things that can be derived or done on the server. Always clean up timers/listeners/polling.
- Avoid prop drilling > 2 levels: compose with children or small context.
- Images via `next/image`; icons via `lucide-react` only (tree-shaken named imports).

## 5. Styling
- Tailwind utilities + CSS variables from `ThemeGuideline.md`. **No hard-coded hex/px colours or fonts in components.** Use semantic classes/tokens (`bg-surface`, `text-muted`).
- Variants via `class-variance-authority` (shadcn pattern) + `cn()` (`clsx` + `tailwind-merge`). Components accept `className`.
- Inline `style` only for runtime values (e.g. bar width via CSS var).
- Mobile-first classes (`base → sm → md → lg → xl → 3xl`). Never rely on hover alone for function.
- Spacing from the 4px scale; radius/shadows from tokens.

## 6. Reusability rules (hard rule)
- Check `COMPONENT_REGISTRY.md` before creating UI. Extract to a shared component on the **second** repeated use.
- Exactly one implementation of: Navbar, MobileNav, Footer, AppShell, PageContainer, SectionHeader, Logo, EmptyState, ErrorState, skeletons, StatusChip, FormBar, ProbabilityGrid, MatchCard, Toaster.
- Page files only compose; no page defines its own navigation, footer, container widths, or skeleton markup.

## 7. Errors and validation
- `AppError(code, message, status, fieldErrors?)` for expected failures; unknown errors are logged and returned as `INTERNAL` (no stack/details to the client).
- Validate **all** external input: env, request bodies/params, URL params, ingest payloads, uploaded files (size/type), CSV cells.
- Every async UI path has loading, empty, error+retry; every mutation has pending, success, failure feedback.
- No empty `catch`. No swallowed promise rejections. `Promise.all` only when partial failure is acceptable (else `allSettled`).

## 8. Data and time
- UTC in DB; conversions only at the edge via `lib/time.ts` (`date-fns-tz`). Never use `new Date()` arithmetic for day windows — use the domain `computeWindow`.
- Percentages stored as 0–100 floats; format with one helper (`formatPct`) — no ad-hoc `toFixed`.
- Missing ≠ zero: nullable columns stay `null`, UI shows "Unavailable".
- Transactions for multi-row writes; upsert for idempotency; never delete user data without a documented rule.

## 9. Security
Never log secrets/tokens/passwords/payloads; compare secrets with `crypto.timingSafeEqual`; no secrets in client bundles (`NEXT_PUBLIC_` is public); sanitize/limit all strings from external sources (length caps, https-only URLs); open-redirect protection for `next`; rate-limit auth and ingest; dependency audit at Step 16.

## 10. Accessibility and motion
Semantic elements first (`button` not `div`), labels for all controls, visible focus, keyboard parity, `aria-live` for run status/toasts, colour never the sole signal, `prefers-reduced-motion` honoured via `components/motion/*` only, animate `transform`/`opacity`.

## 11. Testing
Domain ≥ 95% coverage, services ≥ 85%; every bug fix gets a regression test; components with logic get RTL tests; each user flow has a Playwright test; test names read as behaviour ("does not qualify at exactly 75/35").

## 12. Git and docs
- Branch per step (`step-07-screening-engine`), small commits, Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`), merge only when the step's tests + bug-hunt pass.
- No TODO/FIXME without a `PROJECT_STATE.md` entry. No commented-out code. No `console.log` in app code (use `lib/logger.ts`); CLI scripts under `scripts/` and tests may print.
- **Verify library APIs against the installed version, not memory.** Next.js, Tailwind, Prisma, shadcn, `date-fns-tz`, Framer Motion and Auth-adjacent libs have had breaking changes (e.g. Next 16 `middleware`→`proxy` rename (already applied in these docs), Tailwind v4 `@theme`, Prisma 7 config/adapters, `date-fns-tz` v3 `toZonedTime`/`fromZonedTime`). Read the installed `package.json` versions and the official docs for those versions before coding against them.
- After each step update `PROJECT_STATE.md` and `COMPONENT_REGISTRY.md`; update `ARCHITECTURE.md` when structure/schema/API changes; update `ThemeGuideline.md` first when adding a token.

## 12b. Known API differences in the INSTALLED versions (verified Nov 2026; re-verify if versions change)
- **Next 16:** file convention is `proxy.ts` (was `middleware.ts`), Node.js runtime; `cacheComponents` and `partialPrefetching` are on → read dynamic data (cookies, headers, DB) inside `<Suspense>` boundaries or use `'use cache'` deliberately; docs ship in `node_modules/next/dist/docs`.
- **shadcn 4 (radix-nova):** `cn()` comes from the `cn` package via `src/lib/utils.ts`; the `form` component no longer exists (use react-hook-form + @hookform/resolvers directly).
- **Zod 4:** top-level formats such as `z.url()`; error text is passed as the second argument or `{ error }`; check the Zod 4 docs before using v3 idioms.
- **Vitest 5:** multiple environments use `test.projects` with `extends: true` (see `vitest.config.mts`, ESM config). **MSW 3** and **@testing-library/jest-dom 7** (import `@testing-library/jest-dom/vitest`) — check their docs for handler/API changes.
- **date-fns-tz 3:** `toZonedTime` / `fromZonedTime` (not `utcToZonedTime`).
- **Prisma 7:** `prisma.config.ts`, generator `prisma-client` with an explicit `output`, driver adapter at runtime; CLI and client pinned to 7.10.1 (do not use the 8.0 release candidate).

## 13. Review checklist (agent self-review before "done")
[ ] Matches ApplicationFlow/Scope [ ] Uses tokens only [ ] No duplicate component [ ] States covered (loading/skeleton/empty/error/offline/slow/disabled/success) [ ] Responsive 360→1920 [ ] A11y keyboard + labels [ ] Zod at boundaries [ ] Tests added & green [ ] No secrets/logs leaking [ ] Docs updated
