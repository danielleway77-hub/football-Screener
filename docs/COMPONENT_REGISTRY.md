# COMPONENT_REGISTRY.md (v2)

**Rules:** (1) Check this file before creating any component; reuse or extend. (2) Update it in the same commit as the component. (3) `Status`: planned → in-progress → done (Step N). (4) Every component listed must have all states it can have (see "States") and appear in `/style-guide` (dev-only).

## BUILT IN STEP 3 (status update 2026-11-06 — rows below still say "planned" for historical reasons; this list is authoritative)
Layout: AppShell, Navbar, NavLinks, MobileNav, LogoutButton, Footer, PageContainer, SectionHeader, BackLink · Shared: Logo/LogoGlyph, ConfirmDialog, CopyButton, HelperText, ExternalLink, SegmentedControl, StickyBar, ScrollFade · States: RouteProgress, Skeletons (PageSkeleton, HeaderSkeleton, StatSkeleton, CardSkeleton, MatchCardSkeleton, TableSkeleton, FormSkeleton), EmptyState, ErrorState, Banner, OfflineBanner, StaleBanner, SlowHint, AppErrorBoundary · Motion: Reveal, Stagger/StaggerItem, PageTransition, CountUp, AnimatedBar, PressableScale, SpotlightCard (+ lib/motion.ts) · Illustrations: Radar, PlugPulse, DocumentUpload, Funnel, FunnelSearch, SignalLost, NotFound, Illustration frame, illustrationFor() · Hooks: useOnlineStatus, useSlowRequest, useHoverCapable, useHydrated, useAnimateOnMount · Lib: fetcher.ts, format.ts, nav.ts · match/dimensions.ts (card height constants). NOT yet built: FreshnessPill, DayGroup, BentoSummary, NextKickoff, FilterBar, all match/runs/settings/import components.

## Layout & shell
| Component | Path | Purpose | Key props | States | Built in | Status |
|---|---|---|---|---|---|---|
| AppShell | `components/layout/AppShell.tsx` | Skip link + Navbar + `<main id="main">` + Footer | children | – | Step 3.1 | planned |
| Navbar | `…/Navbar.tsx` | Sticky top nav, active pill (layoutId), logout | – | active, scrolled | 3.1 | planned |
| MobileNav | `…/MobileNav.tsx` | Sheet nav < 768px | – | open/closed | 3.1 | planned |
| Footer | `…/Footer.tsx` | brand, disclaimer, data-freshness slot | lastUpdated? | – | 3.1 | planned |
| PageContainer | `…/PageContainer.tsx` | max-width + gutters | width: content\|wide | – | 3.1 | planned |
| SectionHeader | `…/SectionHeader.tsx` | overline + title + description + actions | overline,title,description,actions | – | 3.1 | planned |
| Logo | `components/shared/Logo.tsx` | wordmark + glyph | size | – | 3.1 | planned |
| Toaster | `components/shared/Toaster.tsx` | sonner themed | – | success/error/info | 2.1 | planned |

## UI primitives (shadcn, themed — never restyle per page)
**DONE (Step 2):** Button (variants default=primary lime/secondary/outline/ghost/destructive/link; sizes default 44/sm 36/lg 52/xs/icons; `loading`) · Card (`interactive`) · Input · Label · Textarea · Select · Switch · Slider · Tabs · Badge · Dialog · Sheet · Tooltip · Skeleton · DropdownMenu · Separator · Table · Form · Checkbox · Progress · ScrollArea · Sonner — `components/ui/*` — Step 2.1/2.3 — **done** (themed with tokens; Badge variants primary/positive/negative/warning/info/neutral; Sonner dark-only).

## Sleek interaction kit & dashboard summary (UI_BLUEPRINT Part 2)
| Component | Path | Purpose | Key props | States | Built in | Status |
|---|---|---|---|---|---|---|
| SpotlightCard | `components/motion/SpotlightCard.tsx` | pointer-following soft lime glow on hover-capable devices only | children, className | off on touch / reduced motion | 3.4 | planned |
| SegmentedControl | `components/shared/SegmentedControl.tsx` | accessible radiogroup with sliding indicator (Settings window/scope, tabs look) | options, value, onChange | disabled, counts | 3.4 | planned |
| StickyBar | `components/shared/StickyBar.tsx` | sentinel-based sticky container; becomes glass when stuck | top, children(isStuck) | stuck / not stuck | 3.4 | planned |
| ScrollFade | `components/shared/ScrollFade.tsx` | horizontal scroll with edge-fade masks, snap | children | overflow left/right | 3.4 | planned |
| useHoverCapable | `hooks/useHoverCapable.ts` | (hover:hover) and (pointer:fine) detection, SSR-safe | – | – | 3.4 | planned |
| BentoSummary / BentoHero / BentoTile | `components/runs/Bento*.tsx` | dashboard top: hero qualifying count + 3 mini tiles (UI_BLUEPRINT §22) | counts, run, settings | zero, stale, loading skeleton | 10.2 | planned |
| NextKickoff | `components/match/NextKickoff.tsx` | live "Next: Wed 19:45 · in 5 h 12 m" line (60s tick, pauses when hidden) | kickoffAt, tz | none | 10.2 | planned |
| FilterBar (sticky) | `components/match/FilterBar.tsx` | StickyBar wrapper around tabs/search/sort with mobile collapse | – | stuck, search expanded | 10.3 | planned |

## Brand, illustrations and orientation (UI_BLUEPRINT Part 3)
| Component | Path | Purpose | Key props | States | Built in | Status |
|---|---|---|---|---|---|---|
| Logo (final) | `components/shared/Logo.tsx` | glyph (circle + lime scan line) + wordmark; glyph-only variant | variant, size | – | 3.5 | planned |
| Illustrations ×7 | `components/illustrations/*.tsx` (Radar, PlugPulse, DocumentUpload, Funnel, FunnelSearch, SignalLost, NotFound) | on-brand empty/error/404 art, currentColor + 1 accent, < 2 KB | size, title, draw | decorative / titled | 3.5 | planned |
| illustrationFor(variant) | `components/illustrations/index.ts` | maps empty-state variants → illustration | variant | – | 3.5 | planned |
| DayGroup | `components/match/DayGroup.tsx` | date header (label + count + hairline) + grid section | date, count, children | single-day tabs: hidden | 10.4 | planned |
| FreshnessPill | `components/layout/FreshnessPill.tsx` | navbar data-freshness pill (dot + "Updated 2 h ago" → /runs) | lastRun, staleAfterHrs | fresh/stale/never/running | 10.4 | planned |
| FormDuel | `components/match/FormDuel.tsx` | one-scale visual of both teams' form vs thresholds with gap bracket (detail hero) | home, away, low, high, qualifies | overlap offset, edges | 11.2 | planned |

## Shared building blocks (generic, reused by many screens)
| Component | Path | Purpose | Key props | States | Built in | Status |
|---|---|---|---|---|---|---|
| ConfirmDialog | `components/shared/ConfirmDialog.tsx` | destructive/irreversible confirmations (revoke token, re-screen) | title, description, confirmLabel, tone, onConfirm | pending, error | 3.1 | planned |
| CopyButton | `components/shared/CopyButton.tsx` | copy to clipboard w/ feedback (tokens) | value | idle/copied/failed | 3.1 | planned |
| PasswordInput | `components/shared/PasswordInput.tsx` | input with show/hide toggle | – | error, disabled | 4.1 | built |
| ExternalLink | `components/shared/ExternalLink.tsx` | `target=_blank rel="noopener noreferrer"` + icon + sr text | href | – | 11.1 | planned |
| Pagination | `components/shared/Pagination.tsx` | URL-param pagination | page,total | disabled ends | 12.1 | planned |
| Breadcrumb / BackLink | `components/layout/BackLink.tsx` | back to dashboard preserving filters | href | – | 11.1 | planned |
| DualThresholdSlider | `components/settings/DualThresholdSlider.tsx` | linked low/high slider + numeric inputs, `low < high` enforced | low,high | invalid, disabled | 13.1 | planned |
| HelperText | `components/shared/HelperText.tsx` | visible reason text for disabled controls | – | – | 3.1 | planned |
| AppErrorBoundary | `components/states/AppErrorBoundary.tsx` | client-side boundary for islands | fallback | – | 3.2 | planned |

## Match
| Component | Path | Purpose | Key props | States | Built in | Status |
|---|---|---|---|---|---|---|
| FormBar | `components/match/FormBar.tsx` | animated form % bar with threshold ticks, label + icon | pct, low, high, label | strong/mid/weak, reduced-motion | 10.1 | planned |
| FormBadges | `…/FormBadges.tsx` | W/D/L last results (letters + colour) | results | empty | 10.1 | planned |
| ProbabilityGrid (compact) | `…/ProbabilityGrid.tsx` | Used INSIDE MatchCard at all widths: row 1 = 3 tiles (Home win · Draw · Away win), row 2 = 2 **PairTiles** (Both teams score Yes/No · Over/Under 2.5) (UI_BLUEPRINT §5) | probs | null → Unavailable, highest 1X2 lime (not on ties), larger of each pair lime | 10.1 | planned |
| PairTile | `…/PairTile.tsx` | two labelled values side by side (Yes/No, Over/Under); larger = lime; complements derived 100 − x | label, aLabel, aValue, bLabel, bValue | null, tie | 10.1 | planned |
| ProbabilityPanel | `…/ProbabilityPanel.tsx` | Detail page "EXACT PROBABILITIES": predicted-score hero + 3 bar rows (Home · Draw · Away) + BTTS Yes/No tiles + Over/Under tiles, mirrors client image #2 (UI_BLUEPRINT §7) | probs, predictedScore, teams | null rows, no predicted score | 11.1 | planned |
| PredictedScore | `…/PredictedScore.tsx` | "3 – 1" + AI chip; compact (card row B) and hero variants; hidden when absent | home, away, variant | absent | 10.1 | planned |
| QualifiesChip | `…/QualifiesChip.tsx` | "QUALIFIES" / "No longer qualifies" | state | – | 10.1 | planned |
| TeamLogo | `…/TeamLogo.tsx` | next/image + initials fallback | name, src | loading, error | 10.1 | planned |
| MatchCard | `…/MatchCard.tsx` | qualifying match summary card (link) | match, thresholds | default, hover, focus, qualifying glow | 10.1 | planned |
| MatchCardSkeleton | `components/states/…` | same dimensions as MatchCard | – | – | 10.1 | planned |
| MatchFilters | `…/MatchFilters.tsx` | day tabs (Upcoming/Today/Tomorrow/Day after), league search (debounced 300ms), sort → URL params | value | pending, hidden Day-after when windowDays=1 | 10.2 | planned |
| MatchHero | `…/MatchHero.tsx` | detail header | match | – | 11.1 | planned |
| MatchPager | `…/MatchPager.tsx` | prev/next qualifying | ids | disabled ends | 11.1 | planned |

## Runs
| RunStatusChip | `components/runs/RunStatusChip.tsx` | RUNNING/SUCCESS/PARTIAL/FAILED/SKIPPED/STALE chip | status | pulse | 10.2 | planned |
| RunStatusPanel | `…/RunStatusPanel.tsx` | last run summary + primary action by mode | run, mode | none/running/success/partial/failed/stale | 10.2 | planned |
| ~~StatsStrip~~ | — | **removed: replaced by BentoSummary / BentoHero / BentoTile (see the Sleek section above)** | — | — | — | removed |
| RunsTable | `…/RunsTable.tsx` | table → stacked cards < 768 | runs | empty, error | 12.1 | planned |
| RunDetailDialog | `…/RunDetailDialog.tsx` | error + failed items | run | – | 12.1 | planned |

## Settings & import
ThresholdForm · ScheduleForm · AccessModeForm · TokenManager · PasswordForm · MaintenanceCard (`components/settings/*`, Step 13.1) · ImportPanel · ImportPreview · HelperInstructions (`components/import/*`, Step 13.2) — planned.

## States
| Component | Purpose | Built in |
|---|---|---|
| RouteProgress | 2px lime top bar on navigation | 3.2 |
| PageSkeleton (dashboard/detail/table/form), CardSkeleton, TableSkeleton, StatSkeleton | skeletons mirroring layouts | 3.2 |
| EmptyState | icon + title + description + action | 3.2 |
| ErrorState | friendly message + collapsible detail + Retry | 3.2 |
| OfflineBanner (+ `useOnlineStatus`) | offline/back-online | 3.2 |
| SlowHint (+ `useSlowRequest`) | "Still working…" after 3s | 3.2 |
| StaleBanner | stale-data warning + action | 3.2 |
All planned.

## Motion
Reveal · Stagger/StaggerItem · PageTransition · CountUp · AnimatedBar · PressableScale · `lib/motion.ts` variants — `components/motion/*` — Step 3.3 — planned.

## Hooks & helpers
`useOnlineStatus`, `useSlowRequest`, `useRunPolling`, `lib/fetcher.ts`, `lib/time.ts`, `lib/format.ts` (`formatPct`, `formatKickoff`) — planned.

## Forbidden duplicates (grep guards, run at Step 16)
`grep -rn "<nav" src` → only Navbar/MobileNav · `grep -rn "<footer" src` → only Footer · `grep -rEn "#[0-9A-Fa-f]{6}" src --include=*.tsx` → none · `grep -rn "@prisma/client" src` → only `lib/db.ts` + repositories/types.

Step 4 additions: RouteError, NotFoundView, RouteFocus, ForceError, PasswordInput (shared).
