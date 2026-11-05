# UI_BLUEPRINT.md — Screen layouts, component anatomy, interactions and copy (v1)

> Companion to `ThemeGuideline.md` (tokens/styles) and `ApplicationFlow.md` (behaviour). **This file says what each screen looks like and where things go.** Agents must read the section for the screen/component they build and compare their result to the wireframe. Wireframes are structural (not pixel art); numbers (px) are binding unless the owner approves a change. Colours/typography come only from `ThemeGuideline.md` tokens.

**Precedence:** the master guide's per-step "UI SPECIFICATION" blocks repeat and extend the values in this file (they are what the agent receives in its prompt). If a number or copy string differs between the two, **the master guide step spec wins for that step**, and the difference must be fixed in this file in the same commit so both stay aligned.

## 0. Design intent (read first)
- **The product is a scanner.** The owner must answer "which matches qualify and what are their numbers?" within 3 seconds of opening the dashboard. Hierarchy: (1) the qualifying cards, (2) data freshness/run status, (3) filters, (4) everything else.
- **Numbers are the heroes.** On every card the percentages are the largest, boldest text (mono). Team names are second. Labels are small overlines.
- **Calm, not busy.** Dark surfaces, one accent. Max **one glow per screen section**; lime only for qualifies/primary action/active/focus.
- **Never colour alone:** every colour signal has a letter/icon/label.
- **Phone first.** She will often check on her phone: single column, big touch targets, no hover-dependence.

## 1. Global frame
```
┌──────────────────────────────────────────────────────────────┐
│ [skip to content]  (visible on focus only)                    │
│ NAVBAR  64px sticky  (z 40)                                   │
├──────────────────────────────────────────────────────────────┤
│ OfflineBanner / StaleBanner (44px, only when active, z 39)    │
├──────────────────────────────────────────────────────────────┤
│ <main id="main">  padding-top 24 (mobile) / 32 (md) / 40 (xl) │
│   PageContainer (content 1280 | wide 1440→1680 @≥1920)        │
│   gutters 16 / 24 / 32                                        │
│ FOOTER  (padding 32 top/bottom, border-top)                   │
└──────────────────────────────────────────────────────────────┘
RouteProgress: 2px lime line fixed at very top (z 80)
Toasts: top-center (mobile, 72px offset) / bottom-right (desktop) (z 70)
```
- Main min-height: `100dvh − navbar − footer` so the footer never floats mid-screen on short pages.
- Section vertical rhythm: header block → 24px → status panel → 16px → stats → 24px → filters → 16px → grid. Between major sections 32/40/56.
- Max content line length 70ch for any prose.

## 2. Navigation (anatomy)
**Desktop ≥768** — height 64: `[Logo 28px]` left; right group gap 4: nav links (40px tall pills, padding 0 14, icon 18 + label 15/500) · divider 1×24 · `Logout` ghost icon button 40×40 (tooltip "Log out"). Active link: text `--text`, 2px lime underline pill (positioned bottom −1px, animates via layoutId), icon lime. Inactive: `--text-muted`, hover bg `rgba(255,255,255,.05)`.
**Mobile <768** — `[Logo]` left, hamburger 44×44 right. Sheet from right, width min(88vw, 360px): header (Logo + close 44×44), links as 56px rows (icon 22, label 17/600, chevron), divider, Logout row (destructive tone text). Sheet closes on route change, Esc, scrim tap.
**Footer** — 3 lines max: brand + © year (left), disclaimer (muted caption, max-width 60ch), freshness slot ("Data updated 06:58") right on desktop / below on mobile.

## 3. Login (`/login`)
```
MOBILE 360                         DESKTOP 1280
┌────────────────────────┐        ┌────────────────────────────────────────────┐
│ (no nav / no footer)   │        │  glow (grad-hero)                            │
│                        │        │            ┌──────────────────────┐          │
│      [Logo md]         │        │            │ [Logo md]            │          │
│                        │        │            │ Sign in              │ h1       │
│  Sign in               │ h1     │            │ Private dashboard…   │ muted    │
│  Private dashboard …   │        │            │ [Password ••••  👁]  │          │
│ ┌────────────────────┐ │        │            │ [  Sign in  ]        │ primary  │
│ │ Password        👁 │ │ 44h    │            │ ⓘ Personal use only  │ caption  │
│ └────────────────────┘ │        │            └──────────────────────┘          │
│ [      Sign in       ] │ 52h    │              card 420w, radius 24, surface   │
│  ⓘ Personal use only   │        └────────────────────────────────────────────┘
└────────────────────────┘
```
- Mobile: no card background; content padded 24, vertically centred (min-height 100dvh, `justify-center`, shifts up when keyboard opens — use `100dvh` and `scroll-padding`).
- Desktop: card 420px wide, padding 40, `--surface` + `.accent-border` hairline (no glow), centred on `--grad-hero` background with noise.
- Field: label "Password" (body-sm 500), input 44h, show/hide toggle 44×44 inside right edge, helper "Enter the password you were given." Error line (icon + text) below field, field border `--negative`.
- Button full width 52h primary; loading: spinner + "Signing in…". Failure → card shakes ±6px×3 over 320ms (reduced-motion: no shake, error text only).
- Lockout: replaces helper with warning banner "Too many attempts. Try again in 12 minutes." and disables the form.

## 4. Dashboard (`/`)
> **v2 update:** the "StatsStrip" blocks drawn in the wireframes below are **superseded by the Bento summary in §22** (hero tile + 3 mini tiles), and the filter row becomes a **sticky glass bar** per §23. Everything else in §4 stands.
### 4.1 Mobile (360) wireframe
```
┌──────────────────────────────┐
│ NAV 64                       │
├──────────────────────────────┤
│ [Stale banner 44 — optional] │
│ DASHBOARD            overline│
│ Qualifying matches        h1 │
│ Form above 75% vs below 35%  │ body-sm muted
│ ┌──────────────────────────┐ │ RunStatusPanel (Card, padding 16)
│ │ ● SUCCESS  Updated 06:58 │ │ chip + "Today 06:58 · 2 h ago"
│ │ 42 scanned · 3 qualify   │ │
│ │ [ Update data  → ] 44h   │ │ primary full-width
│ └──────────────────────────┘ │
│ ┌─────────┐ ┌─────────┐      │ StatsStrip 2×2 grid, gap 12
│ │ 42      │ │ 3       │      │  stat-xl mono + overline label
│ │ SCANNED │ │ QUALIFY │      │
│ ├─────────┤ ├─────────┤      │
│ │ 3       │ │ 06:58   │      │
│ │ SHOWING │ │ UPDATED │      │
│ └─────────┘ └─────────┘      │
│ [Upcoming][Today][Tomorrow]→ │ tabs: horizontal scroll, snap, 40h chips
│ [🔍 Filter by league   ][⇅ ] │ search 44h flex-1 + sort icon button 44
│ ┌──────────────────────────┐ │
│ │ MATCH CARD               │ │ full width
│ └──────────────────────────┘ │
│ …                            │
└──────────────────────────────┘
```
### 4.2 Desktop (1280) wireframe
```
┌────────────────────────────────────────────────────────────────────┐
│ NAV                                                                  │
│ DASHBOARD                                  ┌─────────────────────┐   │
│ Qualifying matches (h1)                    │ ● SUCCESS  06:58    │   │ RunStatusPanel 400w
│ Form above 75% vs below 35%                │ 42 scanned · 3 qual │   │ aligned right of header
│                                            │ [ Run now ]         │   │
│                                            └─────────────────────┘   │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   StatsStrip 4 cols       │
│ │  42    │ │   3    │ │   3    │ │ 06:58  │                           │
│ └────────┘ └────────┘ └────────┘ └────────┘                           │
│ [Upcoming][Today][Tomorrow][Day after]        [🔍 league…][Sort ▾]    │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐                          │
│ │ MatchCard  │ │ MatchCard  │ │ MatchCard  │  3 cols @1280, gap 24    │
│ └────────────┘ └────────────┘ └────────────┘  4 cols @1920 (wide 1680)│
└────────────────────────────────────────────────────────────────────┘
```
Rules: header is a 2-column flex (title block `flex-1`, panel `w-[400px]`) from `lg`; below `lg` stacked. Stats strip = 4 equal cards, each: overline label, `stat-xl` mono value, optional delta/caption. Tabs left, search+sort right (from `md`). Counts show next to tab labels as small mono pills ("Tomorrow 2").
### 4.3 RunStatusPanel states
| State | Content | Action |
|---|---|---|
| No data yet | chip NO DATA (neutral), "Nothing received yet." | mode A: Run now · B/C: Update data |
| Running | chip RUNNING (pulsing lime dot), "Checking fixtures…" + indeterminate 2px bar | button disabled "Running…" + spinner |
| Success | chip SUCCESS, "Updated Today 06:58 · 2 h ago", counts | Run now / Update data |
| Partial | chip PARTIAL (warning), "38 of 42 stored — 4 had problems" | action + link "View details" → /runs |
| Failed | chip FAILED (negative), human error sentence | Retry + "View run" |
| Stale | chip STALE (warning) + StaleBanner above | action emphasized (primary) |
### 4.4 Empty / onboarding states (illustration 160×120 above text)
| Variant | Illustration | Title | Body | Actions |
|---|---|---|---|---|
| No data yet — mode A | radar sweep, lime arc | "No matches yet" | "Run your first check to see matches that meet your rule." | [Run now] |
| No data yet — mode B | plug + pulse line | "Waiting for your first update" | "Open PrediGoal, click the Screener button, and your matches appear here." | [How to update] → /import |
| No data yet — mode C | document with arrow | "Import your first batch" | "Paste or upload the matches file to get started." | [Import data] |
| None qualify | funnel with all dots filtered out | "No matches qualify right now" | "42 scanned at 06:58. None had one team above 75% and the other below 35%." | [Adjust thresholds] ghost → /settings |
| Filtered out | funnel + magnifier | "Nothing matches these filters" | "Try another day or clear the league search." | [Clear filters] |
| Error | broken signal | "Couldn't load matches" | "Check your connection and try again." | [Try again] |
Illustrations: inline SVG, 1.5px strokes in `--text-faint`, one accent stroke in `--primary`, no fills except 8% lime; static (no animation except subtle 600ms draw-on, reduced-motion: none).

## 5. MatchCard anatomy (the signature component)
Width fluid (320–420 px), padding 16 (mobile) / 20 (≥768), radius 16, gap between rows 12–16.
```
┌──────────────────────────────────────────┐
│ 🏆 Peru · Liga 1             [✓ QUALIFIES]│ row A  caption muted, chip right (28h)
│ 🕒 Wed 4 Nov · 19:45   in 1 day  ⚽ 3 – 1 │ row B  kickoff left; PREDICTED SCORE right (mono, “AI” micro-chip) — hidden if absent
│                                            │
│ (logo32) Sporting Cristal            80%  │ row C  team name h4 (1 line, ellipsis); % pill right
│ ████████████████████░░░░░░  ↑ Strong form │        FormBar 8px + label caption
│ ─ tick at 35% and 75% on both bars ─      │
│ (logo32) FC Cajamarca                 7%  │ row D
│ █░░░░░░░░░░░░░░░░░░░░░░░░░  ↓ Poor form   │
│                                            │
│ ───────────────────────────────────────── │ divider
│ HOME WIN        DRAW        AWAY WIN      │ row E  3 tiles equal width
│  76%            16%           8%          │        stat mono 24; highest = lime + “Highest”
│ BOTH TEAMS SCORE    OVER / UNDER 2.5      │ row F  2 PAIR tiles equal width
│ Yes 54%  No 46%     Over 70%  Under 30%   │        each tile: two labelled values; the LARGER one in lime
│                                            │
│ Strong: Sporting Cristal · League form    │ row G  caption muted (+ confidence chip HIGH)
└──────────────────────────────────────────┘
```
- Exact heights (export as constants used by card **and** skeleton): row A 28, row B 20, team block 64 each (name 24 + bar 8 + labels 20 + gaps), probability rows 64 + 64, footer 20; card min-height ≈ 420 mobile / 440 desktop.
- Card is one link (`<article>` + stretched `<a>`); the source link is NOT inside the card (it's on detail). Focus ring on the card edge, radius preserved.
- Qualifying style: `.accent-border` hairline + `--glow-accent` at 60% intensity; hover: translateY(−2px), border brightens, shadow-md; active: scale .995.
- Probabilities **compact variant** (cards): 3 + 2 layout shown above at ALL widths. Row E = three single-value tiles (Home win / Draw / Away win; in the card the labels are generic because team names don't fit ~104px tiles). Row F = two **pair tiles** mirroring the source: "Both teams to score" (Yes / No) and "Over / Under 2.5" (Over / Under); inside a pair tile the two values sit side by side (label 12px muted + value mono 600 16px), the larger value is lime (`--primary`), the smaller `--text`; equal values → neither lime. The pair tile's overline is 12px and may truncate to "BTTS" / "O/U 2.5" below 340px card width (full text in `title`/aria-label). *Pair tiles never display the derived value as if it came from the source without a label: "No"/"Under" are 100 − Yes/Over (D12).*
- **Predicted score** (row B, right): `⚽ 3 – 1` mono 600 14px with a 12px "AI" micro-chip (soft violet) and sr-only "Predicted score {home} {away} from the data source"; hidden entirely when absent; never wraps (kickoff text truncates before it).
- Team name truncation: 1 line ellipsis + `title`; league line truncates; kickoff never wraps.
- Missing probability: tile shows `—` with "Unavailable" sr-only + info icon 14px; tile border dashed.
- Away-strong case: same layout; "Strong: <away team>"; no reordering of teams (home first, always).

## 6. FormBar anatomy
```
Sporting Cristal                              [ 80% ]   ← name left, pill right (mono, soft bg by strength)
░░░░░░░░░░░░░░░░░░░░░░░░░░░|░░░░░░░░░░░|░░░░░░░░░░      ← track 8px radius pill; ticks at 35% and 75% (1×12px, --border-strong, label on hover/focus only)
↑ Strong form        (35%  ·  75%) rule hint          ← caption: icon + label (left); on detail page also show thresholds hint (right, muted)
```
- Fill gradient: strong → `--primary` solid; weak → `--negative`; mid → `#6F8A80`. Animate 700ms ease-out, stagger by card index (max 8).
- Tick marks are decorative (`aria-hidden`); the whole bar has `role="img"` + `aria-label="Sporting Cristal form 80 percent, strong. Rule: strong above 75, weak below 35."`.
- Value pill: padding 2×8, radius pill, mono 600 14px.

## 7. Match detail (`/matches/[id]`)
```
DESKTOP ≥1024
┌────────────────────────────────────────────────────────────────────┐
│ ← Back to dashboard                              [‹ Prev] [Next ›]  │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ 🏆 Peru · Liga 1 · Wed 4 Nov · 19:45 (in 1 day)  [✓ QUALIFIES]│   │ HERO card (surface, accent-border, p 32)
│ │  (logo56) Sporting Cristal        vs        (logo56) FC Cajamarca│   │ names h2, "vs" muted
│ │  Strong: Sporting Cristal · League form · Confidence HIGH     │   │
│ └──────────────────────────────────────────────────────────────┘   │
│ ┌─────────────────────────────┐ ┌──────────────────────────────┐   │
│ │ RECENT FORM (overline)       │ │ PROBABILITIES (overline)     │   │ 2 columns (7/5 split)
│ │ big FormBars + W/D/L badges  │ │ ProbabilityPanel (mirrors    │   │
│ │ form gap  73 pts  (stat)     │ │ PrediGoal “Exact probabilities”)│   │
│ └─────────────────────────────┘ └──────────────────────────────┘   │
│ Data fetched Tue 4 Nov 06:58 · Source: PrediGoal  [Open on PrediGoal ↗]│
└────────────────────────────────────────────────────────────────────┘
MOBILE 360: Back link → hero (stacked: league/time, team vs team stacked vertically with “vs” divider, chip) → Form card → Probability card (tiles 2 cols, 5th spans) → meta → Prev/Next as two 44h buttons side by side.
```
- **ProbabilityPanel (detail page; replaces the old "full grid")** — structure copied from the client's image #2 (`docs/reference/client-image-2.jpeg`), restyled with our tokens:
```
EXACT PROBABILITIES  (overline, pie icon)                         [AI]
┌──────────────────────────────────────────────┐
│ PREDICTED SCORE [AI]                          │ hero tile (surface-raised, accent-border, radius 16, padding 20)
│        3  –  1          (logo) Sporting … – … Cajamarca (logos 28 + names caption) │ score mono 48/1 600, lime digits
├──────────────────────────────────────────────┤
│ (logo) WIN SPORTING CRISTAL              76%  │ 1X2 BAR ROWS, order: Home win · Draw · Away win
│ ██████████████████████████░░░░░░░░░░░░░░░░░░ │  row height 56: label (h4 15/600 uppercase tracking .04em) + value pill (mono) ; bar 8px (--track, lime fill; fill colour lime for the HIGHEST row, --neutral-bar for the others)
│ DRAW                                     16%  │
│ ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ (logo) WIN FC CAJAMARCA                   8%  │
│ ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
├──────────────────────────────────────────────┤
│ BOTH TEAMS TO SCORE (overline)                │
│ ┌ Yes ───────┐ ┌ No ────────┐                 │ two tiles 64h, label centred 14 muted, value mono 24 (larger = lime)
│ │   54%      │ │   46%      │                 │
│ OVER / UNDER 2.5 GOALS (overline)             │
│ ┌ Over ──────┐ ┌ Under ─────┐                 │
│ │   70%      │ │   30%      │                 │
└──────────────────────────────────────────────┘
(the client's screenshot continues below Over/Under with one more card — unknown; see PROJECT_SCOPE §13 question 5b)
```
  Rules: the three bars share one scale (0–100%); each bar animates 700ms with 60ms stagger; the highest 1X2 row gets a lime value pill + lime fill, the others neutral; missing value → row shows "Unavailable" with Info icon and an empty dashed track; the whole panel is `role="group"` with `aria-label="Exact probabilities"`; the "AI" chip has sr-only "Prediction from the data source". Order differs deliberately from PrediGoal (their page lists Home, Away, Draw) — we use Home · Draw · Away (football 1-X-2 convention, matches the card); decision D13, confirm with the client.
- Team names h2 up to 2 lines on detail (no ellipsis unless > 2 lines).
- If no longer qualifying: amber inline note under hero "No longer qualifies under your current thresholds (75% / 35%)." with link to Settings.

## 8. Runs (`/runs`)
```
DESKTOP                                                         MOBILE (cards)
┌──────────────────────────────────────────────────────────┐   ┌──────────────────────────┐
│ RUNS overline / Run history h1        [Status ▾][☐ Show skipped]│ │ ● SUCCESS   Today 06:58 │
│ ┌────────────────────────────────────────────────────────┐ │   │ Cron · official_api      │
│ │ Started        Trigger Mode   Status   Scanned Qual Failed Dur││ │ 42 scanned · 3 qual · 0 │
│ │ Today 06:58    CRON    API     ● SUCCESS  42    3    0    4s ││ │ Duration 4s    [Details]│
│ │ …                                                           ││ └──────────────────────────┘
│ └────────────────────────────────────────────────────────┘ │
│ ‹ 1 2 3 ›  (Pagination)                                      │
└──────────────────────────────────────────────────────────┘
```
Row height 56; numeric columns right-aligned mono; row click/Enter opens RunDetailDialog (desktop dialog 560w; mobile bottom sheet). Details: status chip, times, window, error sentence (muted, wraps), failed items list (index · id · reason) in a scroll area (max-height 320).

## 9. Import (`/import`)
```
┌──────────────────────────────────────────────────────────────┐
│ DATA INTAKE / Update your matches (h1)                         │
│ [ Assisted helper ] [ Paste / upload ]   ← tabs                │
│ ── Paste / upload ───────────────────────────────────────────  │
│ ┌ drop zone (dashed, 160h) ───────────────────────────────┐   │
│ │  ⬆  Drop a JSON or CSV file, or [Choose file]            │   │
│ │  Max 1 MB · Sample: [JSON] [CSV]                         │   │
│ └──────────────────────────────────────────────────────────┘   │
│ or paste data: ┌ textarea 8 rows mono ─────────────────────┐   │
│ Preview  (valid 38 · invalid 4 · qualifying 3)                  │
│ table: row · match · form H/A · status (✓ / ✗ reason)           │
│ [ Import 38 matches ]  (primary)   [Clear]                      │
│ Result card after submit: counts + [View dashboard]             │
└──────────────────────────────────────────────────────────────┘
```
Assisted tab: numbered steps (1 Install Tampermonkey, 2 Install script, 3 Paste token, 4 Press “Update data” on PrediGoal) each a card with a number badge; token selector; "Last ingest" status line; reminder box (info tone): "On PrediGoal select **League form** before you press Update data."

## 10. Settings (`/settings`)
```
DESKTOP ≥1024                                     MOBILE
┌──────────┬───────────────────────────────┐     stacked cards, each collapsible header
│ sticky   │ ┌ Screening ───────────────┐   │     [sticky save bar bottom: "Unsaved changes"
│ section  │ │ Slider low/high + inputs │   │      [Discard] [Save changes]  safe-area padding]
│ nav 220w │ │ Window ◉1 ○2  Scope …    │   │
│ • Screening│ └──────────────────────────┘   │
│ • Schedule │ ┌ Schedule & timezone ─────┐   │
│ • Data     │ …                              │
│ • Tokens   │ ┌ Maintenance (re-screen) ─┐   │
│ • Security │ Save bar sticky bottom of form │
└──────────┴───────────────────────────────┘
```
- Cards max-width 720; section nav highlights current section on scroll (IntersectionObserver); anchor links `#screening` etc.
- **Dual threshold control:** one track 0–100; two lime thumbs (low, high) with value bubbles; zones shaded: below low (negative soft), between (neutral), above high (primary soft); numeric inputs beside (width 72, mono). Live sentence: "Qualifies when one team is above **75%** and the other below **35%**."
- Token creation modal: shows `scr_…` in mono box with CopyButton and a warning callout "Copy it now — you won't see it again."
- Save bar: appears when dirty (slide-up 240ms); buttons "Discard" (ghost) and "Save changes" (primary, loading state).

## 11. System pages
- **404:** large mono "404" (stat-xl, muted), h1 "Page not found", body, [Back to dashboard] primary; subtle pitch-line glyph.
- **Error / global-error:** negative-soft icon circle, h1 "Something went wrong", body "We couldn't complete that. Try again.", [Try again] + [Dashboard]; collapsible "Technical details" showing only an error code/digest.
- **Offline:** banner (warning) "You're offline. Changes can't be saved until you reconnect." + dismiss none; recovery "Back online" (success) 3s.

## 12. Interaction and micro-interaction table
| Element | Trigger | Effect | Duration/easing |
|---|---|---|---|
| Primary button | hover | lift glow + sheen sweep | 150ms / 600ms sweep |
| Any button | press | scale .98 (spring) | 120ms |
| Match card | hover | translateY −2, border brighten, shadow-md | 180ms ease-out |
| Match card | focus-visible | 2px bg gap + 2px lime ring | instant |
| Nav active pill | route change | slides to new link | 260ms spring |
| Tabs (day) | select | indicator slides; grid cross-fades (opacity 0.4→1) | 200ms |
| FormBar | first view | fill 0→value | 700ms ease-out, +60ms × index |
| Numbers | first view | count-up | 800ms |
| Probability highest tile | first view | soft lime bg fades in after count-up | 300ms |
| Toast | show/hide | slide 12px + fade | 240ms |
| Dialog/Sheet | open | scale .98→1 + fade / slide from edge | 240ms spring |
| Save bar | dirty | slide up | 240ms |
| Skeleton → content | data ready | cross-fade, no layout change | 200ms |
| Route change | navigation | top progress bar; page fade+8px | 350ms |
| Copy button | click | icon swaps to check + "Copied" | 2s |
| Password toggle | click | eye ↔ eye-off | instant |
| Offline banner | change | slide down 44px | 240ms |
Everything above degrades to instant/opacity under `prefers-reduced-motion`.

## 13. Loading choreography
1. Navigation: RouteProgress starts immediately; shell (nav/footer) stays; page area shows `loading.tsx` skeleton **identical in layout** to the final page.
2. Data arrives: skeleton → real content cross-fade 200ms (no height change; skeleton constants shared).
3. Cards enter with stagger (max 8, 60ms); bars fill; numbers count once.
4. Filter change: grid section dims to 0.4 opacity + shows 3 skeleton cards only if the request exceeds 300ms (avoid flicker), then cross-fades.
5. Never show spinners for page loads; spinners only inside buttons.

## 14. Responsive behaviour by component
| Component | <480 | 480–767 | 768–1023 | 1024–1279 | 1280–1919 | ≥1920 |
|---|---|---|---|---|---|---|
| Navbar | logo + hamburger | same | inline links | inline | inline | inline (wide container) |
| Dashboard header | stacked | stacked | stacked | 2-col (title + panel) | 2-col | 2-col |
| Stats strip | 2×2 | 2×2 | 4 cols | 4 | 4 | 4 |
| Day tabs | scroll chips | scroll chips | inline | inline | inline | inline |
| Filters row | stacked (search over sort) | search + sort inline | inline right | inline right | inline right | inline right |
| Match grid | 1 col | 1 col | 2 col | 2 col | 3 col | 4 col |
| MatchCard probabilities | 3+2 compact | 3+2 | 3+2 | 3+2 | 3+2 | 3+2 |
| Detail hero | stacked | stacked | stacked | 2-col | 2-col | 2-col |
| Detail ProbabilityPanel (score hero + 3 bar rows + 2 pair-tile rows; single column at every width, fills its card) | full width | full width | full width (card) | right column ≈ 5/12 | same | same |
| Runs | cards | cards | table | table | table | table |
| Settings | stacked + sticky save | stacked | stacked | side nav + cards | side nav + cards | side nav + cards |
| Dialogs | bottom sheet | bottom sheet | dialog | dialog | dialog | dialog |
| Toasts | top-center | top-center | bottom-right | bottom-right | bottom-right | bottom-right |

## 15. Data-display formatting rules
- Percent: `80%` (no space), mono; integers without decimals; if source has decimals show max 1 (`62.5%`); never `0.8`. Missing: `—` in tables, "Unavailable" in tiles.
- Kickoff: `Wed 4 Nov · 19:45` in owner TZ (24h), relative `in 1 day` / `in 3 h` / `Today 19:45`; if kickoff passed → hidden on dashboard.
- Run times: `Today 06:58`, `Yesterday 06:58`, else `Mon 3 Nov 06:58`; relative `2 h ago`.
- League: `Country · League` (truncate); no flags in v1 (avoid asset dependency).
- Team names: as supplied (trim); no title-casing.
- Durations: `4s`, `1m 12s`.
- Counts: thousands separators not needed (< 1000).

## 16. Copy deck (verbatim strings; keep tone: short, factual, numbers first)
| Key | String |
|---|---|
| Dashboard h1 | Qualifying matches |
| Dashboard sub | Form above {high}% vs below {low}% |
| Panel — updated | Updated {time} · {relative} |
| Stats labels | Scanned · Qualifying · Showing · Updated |
| Tabs | Upcoming · Today · Tomorrow · Day after |
| Search placeholder | Filter by league |
| Sort options | Kickoff (soonest) · Biggest form gap |
| Card chip | QUALIFIES |
| Strong label | Strong form · Poor form · Average |
| Card prob labels | Home win · Draw · Away win · Both teams score · Over / Under 2.5 (short: BTTS · O/U 2.5) |
| Pair values | Yes · No · Over · Under |
| Panel (detail) | EXACT PROBABILITIES · PREDICTED SCORE · WIN {TEAM} · DRAW · BOTH TEAMS TO SCORE · OVER / UNDER 2.5 GOALS |
| Predicted score | Predicted score {h} – {a} (sr: "Predicted score {h} {a} from the data source") · chip "AI" |
| Derived note (tooltip + sr) | "No" and "Under" are calculated as 100 − Yes / 100 − Over. |
| Highest label | Highest |
| Unavailable | Unavailable |
| Detail back | Back to dashboard |
| Detail CTA | Open on PrediGoal |
| No longer qualifies | No longer qualifies under your current thresholds ({high}% / {low}%). |
| Run now / Update data | Run now · Update data |
| Running | Checking fixtures… |
| Run success toast | {n} qualifying matches found. · No matches qualify right now. |
| Run failed toast | The check didn't finish. Try again. |
| Stale banner | Data is {n} hours old. {Run now / Update data} to refresh. |
| Offline banner | You're offline. Changes can't be saved until you reconnect. |
| Back online | Back online. |
| Slow hint | Still working… this is taking longer than usual. |
| Login h1 / sub | Sign in · Private dashboard for your football screening. |
| Login error | Incorrect password. |
| Login lockout | Too many attempts. Try again in {n} minutes. |
| Settings saved | Settings saved. · Re-screen to apply to stored matches. |
| Re-screen confirm | Re-screen {n} stored matches with {high}% / {low}%? |
| Re-screen result | {changed} changed · {qualifying} now qualify. |
| Token warning | Copy it now — you won't see it again. |
| Revoke confirm | Revoke "{label}"? The helper using it will stop working. |
| Password changed | Password updated. Other devices were signed out. |
| Import success | Imported {valid} matches · {qualifying} qualify. |
| Import partial | {valid} imported, {invalid} skipped. See reasons below. |
| Footer disclaimer | Personal use only. Probabilities come from the data source; this tool does not give betting advice. |
| 404 | Page not found · The page you're looking for doesn't exist. |
| Error | Something went wrong · We couldn't complete that. Try again. |
Accessible names: nav links = label; icon buttons: "Open menu", "Close menu", "Log out", "Copy token", "Show password"/"Hide password"; FormBar: "{team} form {pct} percent, {strong|average|poor}".

## 17. Visual QA rubric (score each screen 0–2 per row; target ≥ 18/20, no zeros)
1. Hierarchy: numbers → names → labels clear in 3 seconds 2. One accent used only for meaning 3. Spacing follows the 4px scale/rhythm 4. Alignment (grid, baselines, numeric columns) 5. Contrast (`pnpm contrast`, text ≥ 4.5) 6. Touch targets ≥ 44 and spacing ≥ 8 7. Responsive (360→2560, no horizontal scroll, no clipping) 8. States complete (loading/empty/error/offline/slow/disabled) 9. Motion purposeful, smooth, reduced-motion safe 10. Consistency (same component → same look everywhere).

## 18. Anti-patterns (reject in review)
Rainbow charts · more than one glow on screen · lime body text · cards inside cards inside cards · hover-only information · tooltip-only reasons · colour-only status · spinners for page loads · different navbars per page · hard-coded hex · text under 12px · centered long paragraphs · stock photos · fake data in production · layout shift on load · animation that delays reading · modal for everything (prefer inline).

## 19. UI deliverable checklist (per UI step)
[ ] Wireframe section re-read and followed [ ] Screenshots at 360/768/1280/1920 attached to `docs/reference/ui-review/<step>/` [ ] States screenshots (loading, empty, error, offline) [ ] Copy matches §16 [ ] Rubric scored (§17) [ ] Registry updated [ ] No console warnings

---

# PART 2 — MODERN, SLEEK VISUAL SYSTEM (v2 additions)

> Research-backed direction (Nov 2026): dark interfaces get their definition from **hairline borders more than shadows**; near-black/deep-green canvases with **stepped surface tones** beat pure black; **tabular numerals** keep data steady; **bento-style modular layouts** create hierarchy without extra chrome; motion should *answer a question* (150–200 ms micro, 200–300 ms small, 300–500 ms large) and skeletons must keep stable dimensions. Sources: [Line25 2026 trends](https://line25.com/articles/web-design-trends-2026/), [StudioMeyer 2026 reality check](https://studiomeyer.io/en/blog/webdesign-trends-2026-reality-check), [bento grids](https://studiomeyer.io/en/blog/bento-grid-layouts), plus community design-principles guides on borders and tabular numbers (practitioner sources, not standards). The aim is **"quiet precision"**: sleek and modern, never flashy — this is a tool used daily to read numbers.

## 20. Visual language — "quiet precision"
1. **Borders over shadows.** Cards, tiles, inputs and chips are defined by a 1px translucent hairline (`--hairline`). Drop shadows exist only on *floating* layers (popover, dialog, sheet, toast).
2. **Stepped surfaces, one hue.** Elevation = +3–4% lightness steps of the same green-black (`--surface` → `--surface-raised` → `--surface-overlay`), never different colours.
3. **Light, not paint.** Lime behaves like light: a hairline, a glow, a thin bar, a number — never a large flat area. **Lime budget: < 3% of the viewport's pixels** on any screen (tested, §28).
4. **Glass only on chrome.** Backdrop blur appears on the navbar, the sticky filter bar and sheets only — never on cards.
5. **Inner highlight.** Every raised surface has a 1px top inner highlight (`inset 0 1px 0 rgba(255,255,255,.04)`) that makes edges feel crisp on dark.
6. **Space for numbers.** Stat values get ≥ 16px padding on all sides and share a baseline with their label; numbers are the largest, boldest text in any tile.
7. **Radius ladder.** Only 8 · 12 · 16 · 20 · 24 · 999. Nested radius = outer radius − padding (never a larger inner radius).
8. **Hierarchy by weight and size, not colour.** Use `--text` / `--text-muted` / `--text-faint` for three levels; reserve hue for meaning.
9. **Texture is almost invisible.** Static 3% noise on the page background and hero panels only.
10. **Motion confirms, never decorates** (see §26).

## 21. Surface and component recipes (copy exactly; tokens in ThemeGuideline §2.4c)
```css
:root{
  --hairline: rgba(255,255,255,.08);          /* default 1px outline on dark surfaces */
  --hairline-strong: rgba(255,255,255,.14);   /* hover / raised surfaces */
  --inner-highlight: inset 0 1px 0 rgba(255,255,255,.04);
  --glass-bg: color-mix(in srgb, var(--bg-base) 78%, transparent);
}
.surface-1{ background:var(--surface); border:1px solid var(--hairline); box-shadow:var(--inner-highlight); }                                   /* cards */
.surface-2{ background:var(--surface-raised); border:1px solid var(--hairline-strong); box-shadow:var(--inner-highlight), var(--shadow-sm); }   /* tiles inside cards, dropdowns, popovers */
.surface-3{ background:var(--surface-overlay); border:1px solid var(--hairline-strong); box-shadow:var(--inner-highlight), var(--shadow-lg); }  /* dialogs, sheets */
.glass{ background:var(--glass-bg); -webkit-backdrop-filter:blur(14px) saturate(140%); backdrop-filter:blur(14px) saturate(140%); border-bottom:1px solid var(--hairline); }
```
| Component | Recipe |
|---|---|
| Card (default) | `.surface-1` + `--grad-card`; radius 16; no resting shadow |
| Interactive card (hover, pointer devices) | border → `--hairline-strong`; `translateY(-2px)`; **spotlight** overlay (§25); `--shadow-md` appears only on hover |
| **Qualifying card** | `.accent-border` hairline gradient + `inset 0 1px 0 rgba(200,245,46,.18)` + outer glow `0 0 36px -10px rgba(200,245,46,.22)` (one glow per card, never stacked) |
| Stat tile | `.surface-2`, radius 16, padding 16–20 |
| Primary button | fill `--primary`; `box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 8px 24px -10px rgba(200,245,46,.55)`; hover `--primary-hover` + sheen; active scale .98 |
| Secondary / ghost | secondary = `.surface-2` fill + hairline; ghost = transparent, hover `rgba(255,255,255,.05)` |
| Input | fill `--bg-subtle`; border `--border-control` (≥ 3:1); `inset 0 1px 2px rgba(0,0,0,.35)`; focus ring + border → `--primary` |
| Chip | soft tint bg + 1px translucent border of the same hue; no shadow |
| Tabs / segmented control | track `--track` + hairline; selected pill `--primary-soft` + `--primary-border`; indicator slides (spring) |
| Navbar / sticky bars | `.glass` |
| Dialog / sheet | `.surface-3` + scrim `--scrim` blur(8px) |
| Toast | `.surface-3`, radius 12, left 3px status bar |
| Skeleton | shape of the real element, `--skeleton` fill, shimmer opacity ≤ .06 |
Rule: a surface has **either** a hairline **or** a shadow at rest, not both (the inner highlight is the only exception).

## 22. Bento summary (dashboard top)
```
DESKTOP ≥1280 (12-col grid, gap 16, row height 128)
┌───────────────────────────────┬──────────┬──────────┬──────────┐
│ QUALIFYING NOW   (overline)    │ SCANNED  │ UPDATED  │ SHOWING  │
│  3   (stat-xl 64px mono lime)  │  42      │  06:58   │  3       │
│ matches meet your 75% / 35% rule│ today    │ 2 h ago  │ of 3     │
│ [Tomorrow 2] [Day after 1]   Next: Wed 19:45 · in 5 h 12 m      │
│ (col-span 6)                   │ (span 2) │ (span 2) │ (span 2) │
└───────────────────────────────┴──────────┴──────────┴──────────┘
TABLET 768–1279: hero full width (12), then 3 tiles (span 4 each)
MOBILE <768: hero full width (112px tall); then 3 compact tiles in one row (each ≈104w × 88h, padding 12, value 20px mono)
```
- **Hero tile** (`BentoHero`): `.surface-2`; when count > 0 it gets the accent hairline plus a soft lime radial at the top-left (8% opacity); when 0 it is neutral with a muted number. Content: overline "QUALIFYING NOW", count (stat-xl, 64px desktop / 48px mobile, CountUp once), caption "matches meet your {high}% / {low}% rule" (body-sm muted), a chip row of per-day counts (clicking a chip selects that tab), and a **"Next kickoff"** line (caption mono) "Wed 19:45 · in 5 h 12 m" that updates every 60 s (hidden if none). Zero state: "No matches qualify right now" (no chips).
- **Mini tiles** (`BentoTile`): overline label, value (stat mono 28px desktop / 20px mobile), caption below ("today", "2 h ago", "of 3"). The "Updated" value is HH:MM and turns `--warning` text when stale. All numbers tabular.
- Skeleton = the same grid with the same heights (no layout shift).

## 23. Sticky filter bar
- The filter row (day tabs + search + sort) becomes **sticky under the navbar** (`top: 64px`, z-index 39) with `.glass`, a hairline bottom border and 8px vertical padding **only after it reaches the navbar** (IntersectionObserver sentinel); before that it is part of the page flow with no background.
- Mobile: the sticky bar shows only the **day tabs** (48px tall); search collapses to a 44×44 icon button at the right that expands the search field inline (slides over the tabs, 200ms, with a close button); sort lives in the same overflow menu.
- While sticky, a caption "Showing 3 matches" stays visible at the right on desktop.

## 24. Typography refinement (extends ThemeGuideline §3)
- **Dense UI text is 14px** (tables, chips, captions, helper text, secondary labels); **controls 15px**; **prose 16px**; **inputs on mobile 16px** (prevents iOS zoom). Overlines 12px / 600 / +0.14em.
- Numbers: `font-variant-numeric: tabular-nums slashed-zero; font-feature-settings: "tnum","zero";` on every data value (JetBrains Mono, class `.num`). No proportional digits anywhere a number can change or align.
- Weights: 400 body · 500 labels/controls · 600 names/small headings · 700 only h1 and stat values. Never 300.
- Headings track −0.015em; uppercase text tracks +0.08 to +0.14em; never mix both in one line.
- At most 3 different font sizes inside one card; numbers are always the largest.
- Truncation uses `text-overflow: ellipsis` with `title`; never truncate mid-number.

## 25. Pointer spotlight and shine (delight, restrained)
- **SpotlightCard** (`components/motion/SpotlightCard.tsx`): only on `(hover: hover) and (pointer: fine)`; a radial gradient `radial-gradient(240px circle at var(--mx) var(--my), rgba(200,245,46,.10), transparent 60%)` overlays the card (pointer-events none), `--mx/--my` updated via requestAnimationFrame from `pointermove`, opacity 0→1 over 200ms on enter and back on leave. No effect on touch or with reduced motion. Used on MatchCard and the bento hero only.
- **Shine** on the primary button: a 600ms diagonal sheen sweep on hover (CSS), not on touch.
- No cursor-following elements elsewhere; no parallax; no tilt.

## 26. Motion personality — "calm precision"
| Tier | Use | Duration | Easing |
|---|---|---|---|
| Micro | press, toggle, hover colour, focus | 120–180 ms | ease-out |
| Small | tooltip, dropdown, chip, tab indicator, toast | 200–260 ms | ease-out / spring(380, 30) |
| Medium | card enter, dialog/sheet, banner slide, filter cross-fade | 280–400 ms | ease-out |
| Large | page transition, login entrance | 350–600 ms | ease-out |
| Data | bar fill 700 ms, count-up 800 ms (once, on first view) | — | ease-out |
Rules: every animation answers a question ("did it register?", "what changed?", "where did it go?"); stagger max 8 items × 60 ms; nothing animates on scroll except one-time reveals; shimmer is subtle; **optimistic UI is not used in v1** (all writes are explicit and confirmed) — if added later, roll back visibly with an animation, never silently.

## 27. Optional shared-element transition (progressive enhancement)
Card → detail: use the View Transitions API when available (`document.startViewTransition`, or Next's `viewTransition` support in the installed version) to morph the team logos and FormBars (`view-transition-name: match-{id}-home-logo`, etc.) over 300ms ease-out. Feature-detect; fall back to the normal fade + 8px page transition; disabled under reduced motion; must not delay navigation (> 100 ms start delay is a bug). If the installed Next version doesn't support it cleanly, skip it and record the decision in `PROJECT_STATE.md`.

## 28. Sleek acceptance tests (automatable — implement in Step 15.5)
| Test | How | Pass |
|---|---|---|
| Lime budget | Playwright screenshot → count pixels near `--primary` | < 3% of pixels on dashboard, detail, settings; < 4% on login |
| Radius ladder | script walks the DOM and reads `border-radius` | every value ∈ {0, 8, 12, 16, 20, 24, 999px} (or `50%` for circles) |
| No pure colours | computed backgrounds | none equal `#000000` or `#FFFFFF` |
| Shadows only on floating layers | computed `box-shadow` of cards/tiles at rest | no outer shadow (inner highlight allowed) |
| Tabular numerals | elements with `.num` / stat classes | `font-variant-numeric` includes `tabular-nums` |
| Hairline consistency | card borders | 1px, white alpha ≤ .14 |
| Glow budget | count of elements using `--glow-accent` in the viewport | ≤ 8 (qualifying cards) + 0 elsewhere |
| Touch targets | boundingBox | ≥ 44 |
| Font sizes | computed `font-size` | no text < 12px |
| Layout stability | CLS | < 0.05 |

## 29. "Sleek" review checklist (used in Appendix A2)
[ ] Cards read as quiet panels — no heavy shadows at rest [ ] Edges crisp (hairline + inner highlight) [ ] Numbers dominate and align (tabular) [ ] Lime is rare and meaningful [ ] Navbar/sticky bar glass looks clean over content [ ] Spacing consistent, nothing cramped [ ] Radii follow the ladder [ ] Hover/focus feedback is immediate and subtle [ ] Motion calm — no bounce except the press/pill spring [ ] Empty/loading states look as designed as the loaded state [ ] Looks calmer and clearer than the client's own PrediGoal screen

---

# PART 3 — BRAND KIT, SIGNATURE VISUALS, ORIENTATION AIDS, MICRO-DETAILS (v3 additions)

## 30. Micro-detail checklist (the invisible 5% that makes it feel finished)
Implement these as global CSS/HTML defaults in Step 15.6 (and keep them true forever):
| # | Detail | Implementation |
|---|---|---|
| 1 | Dark browser chrome | `<meta name="color-scheme" content="dark">`, `color-scheme: dark`, `theme-color #070A09` |
| 2 | No grey tap flash | `-webkit-tap-highlight-color: transparent`; provide our own `:active` feedback (scale .98 / bg) |
| 3 | No double-tap zoom delay | `touch-action: manipulation` on buttons, links, tabs, inputs |
| 4 | Hover only where hover exists | wrap every hover style in `@media (hover: hover) and (pointer: fine)` so touch never gets "stuck" hover |
| 5 | Anchor/focus scroll clearance | `scroll-padding-top: 88px` (navbar 64 + sticky bar) on `html`; `scroll-margin-top` on section anchors |
| 6 | No layout jump when scrollbar appears | `scrollbar-gutter: stable` on `html`; thin themed scrollbars (`scrollbar-width: thin; scrollbar-color: var(--hairline-strong) transparent`) |
| 7 | Balanced headings, tidy paragraphs | `text-wrap: balance` on h1–h3, `text-wrap: pretty` on paragraphs/descriptions |
| 8 | Font rendering | `font-optical-sizing: auto; font-synthesis: none; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility` (headings) |
| 9 | Tabular numbers everywhere | `.num` utility (§24); stat classes include it |
| 10 | Focus only for keyboard | use `:focus-visible` exclusively; no focus outline on mouse click; ring per ThemeGuideline |
| 11 | Native control colours | `accent-color: var(--primary)`; `caret-color: var(--primary)` |
| 12 | Mobile keyboards | search: `type="search" inputmode="search" enterkeyhint="search"`; numeric inputs `inputmode="numeric"`; password `autocomplete="current-password"`; no autocapitalize on search |
| 13 | Selection colour | `::selection { background: var(--primary-soft); color: var(--text) }` |
| 14 | Overscroll | `overscroll-behavior: contain` on sheets, dialogs, scroll areas; `overscroll-behavior-y: none` on `body` only if pull-to-refresh isn't wanted (keep default on mobile) |
| 15 | Truncation works in flex | `min-width: 0` on flex/grid children that contain truncating text |
| 16 | Never `transition: all` | list properties explicitly (`transition: transform .18s var(--ease-out), border-color .18s, box-shadow .18s`) |
| 17 | `will-change` discipline | only while animating (set/unset), never permanent |
| 18 | Images/SVG reserve space | explicit `width`/`height` or `aspect-ratio`; no CLS from logos |
| 19 | Viewport units | `dvh`/`svh` (never `100vh`) for full-height layouts; `env(safe-area-inset-*)` on fixed bars |
| 20 | Cursors | `cursor: pointer` only on actionable elements; `not-allowed` on disabled; `text` on inputs |
| 21 | Link style | underline-offset 4px, thickness 1px, hover thickness 2px; external links show the icon |
| 22 | Icon alignment | inline icons use `.icon-inline { width:1em; height:1em; vertical-align:-0.125em; flex:none }`; icon + text in `inline-flex` with `gap` |
| 23 | Reduced transparency | `@media (prefers-reduced-transparency: reduce)` → `.glass` becomes solid `--bg-base`, scrims lose blur |
| 24 | Smooth scroll | `scroll-behavior: smooth` only inside `@media (prefers-reduced-motion: no-preference)` |
| 25 | Empty text nodes | no stray "0" or "undefined" from falsy renders; `—` for missing in tables |
| 26 | Selection of numbers | numeric tiles `user-select: all` is NOT used (annoying); normal selection |
| 27 | Preload critical font | `next/font` self-hosting with `adjustFontFallback` (size-adjust) to avoid font-swap CLS |
| 28 | Long lists | `content-visibility: auto; contain-intrinsic-size: auto 56px` on Runs rows (not on cards) |
| 29 | Print | minimal: hide navbar/footer/buttons, light-on-dark swapped to dark-on-white for the match detail page (nice-to-have) |
| 30 | 404/offline assets | no external requests required to render error pages (inline SVG only) |

## 31. Contrast and system modes
- **`prefers-contrast: more`:** `--hairline` → `rgba(255,255,255,.30)`, `--hairline-strong` → `.45`, `--border-control` → `#8FA79B`, `--text-muted` → `--text`, `--text-faint` → `--text-muted`, focus ring 3px, remove glows and spotlight, keep letters/icons on all status indicators.
- **`forced-colors: active` (Windows High Contrast / Contrast themes):** rely on system colours — borders `CanvasText`, text `CanvasText`, backgrounds `Canvas`, links `LinkText`, focus ring `Highlight` (3px, `outline` not `box-shadow`), primary buttons `ButtonText` on `ButtonFace` with a visible border, selected tab/segment gets a `Highlight` border + `HighlightText`, FormBar fill uses `Highlight` and track `GrayText`, probability highest uses `Highlight` border + the "Highest" label, illustrations and icons use `currentColor`; no gradients/backdrop blur/box-shadow reliance (use `border`/`outline`); `forced-color-adjust: none` only for the bar fills if needed and with `Highlight`.
- **`prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-color-scheme`:** motion and transparency honoured; colour scheme stays dark (we declare it; no light theme in v1).
- **Zoom/text-scale:** the layout must survive 200% zoom and 200% text size without clipping or horizontal scroll (rems/clamp, no fixed heights on text containers except the card constants, which use `min-height`).

## 32. Brand and illustration kit (geometry the agent must follow)
**Glyph (24×24 viewBox, stroke-based, `currentColor` + one lime stroke):** a pitch centre-circle with a scan line.
- Circle: centre (12,12), r 8, stroke 1.75, `currentColor`, fill none.
- Halfway line: vertical, x 12, from y 2.5 to 21.5, stroke 1.75, `currentColor` at 40% opacity.
- **Scan line (accent):** horizontal, y 12, from x 2 to x 22, stroke `var(--primary)` 2, round caps; two small end ticks at x 2 and x 22 (vertical ±2.5, same stroke).
- Optimal sizes 20/24/28/32; never filled; on `--bg-base` the glyph reads as a "circle being scanned".
**Wordmark:** "SCREENER", Space Grotesk 700, 15px, letter-spacing .12em, `--text`; glyph 28px + 10px gap; a compact variant is the glyph only (favicons, sheet header).
**Favicon/app icon:** rounded square 32/192/512 (radius 22%), background `#070A09`, the glyph centred at 60% size, scan line lime, circle `#F2F7F4`. OG image 1200×630 per Step 15.1.
**Illustrations (160×120 viewBox 0 0 160 120, stroke 1.5, round caps/joins, fill none except 8% lime washes; colours: `--text-faint` strokes + ONE accent stroke; no gradients):**
| Name | Used for | Composition |
|---|---|---|
| `RadarIllustration` | no data yet (mode A) | three concentric circles (r 18, 36, 54) centred (80,64); a lime 60° sweep wedge with 8% lime fill; centre dot r 3 lime; two blips (r 2) |
| `PlugPulseIllustration` | no data yet (mode B) | a plug (rounded rect 36×28 + two prongs) on the left connected by a line to a heartbeat polyline on the right (lime) |
| `DocumentUploadIllustration` | no data yet (mode C) | document 56×72 radius 8 with folded corner and three text lines; lime up-arrow rising from the bottom edge |
| `FunnelIllustration` | none qualify | funnel (trapezoid 80 wide → neck 16, height 56); six small circles above; none below; lime short line at the neck |
| `FunnelSearchIllustration` | filtered out | funnel + a magnifier (circle r 14, lime handle) overlapping the right side |
| `SignalLostIllustration` | error / offline | three signal arcs with the middle arc broken (gap); a small `--negative` slash/cross; remaining arcs `--text-faint` |
| `NotFoundIllustration` | 404 | pitch circle outline with a "?" mark in lime |
Rules: each is a React component `({ size = 160, title?: string, className })`, decorative by default (`aria-hidden`) unless `title` given; no external fetch; < 2 KB each; optional `data-draw` attribute to run a 600 ms stroke-dashoffset draw-on (reduced motion: none); colours only from tokens (`currentColor`, `var(--primary)`, `var(--negative)`).

## 33. FormDuel — the one-glance "why it qualifies" visual (detail page hero)
```
FORM  0%                    35%                               75%                    100%
      │░░░ weak zone ░░░░░░░░│▒▒▒▒▒ neutral zone ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│▓▓▓ strong zone ▓▓▓▓▓▓│
      (C)7 ●                                                          ● (S)80
             └─────────────── gap 73 pts ───────────────────────────┘
```
- One horizontal track (height 12, radius pill, max-width 640, full width on mobile) on `--track` with three shaded zones: 0–low `--negative-soft`, low–high `--neutral-soft`, high–100 `--primary-soft`; threshold ticks at {low} and {high} with labels under the track (`35%`, `75%`, mono 12px muted).
- **Two markers** = TeamLogo 28px with a 2px ring (home `--text`, away `--text-muted`) positioned at left = formPct% (clamped 2–98% so they stay inside), with a small value label above ("80%"). Markers animate from 0 to position (700ms ease-out, 60ms stagger). If the markers would overlap (|Δ| < 8%), the lower-valued marker moves *below* the track with a leader line.
- **Gap bracket:** a 2px line between the markers (`--primary` when the match qualifies, `--text-faint` otherwise) with a centred pill "gap 73 pts" (mono 12px).
- Semantics: `role="img"`, aria-label "{Home} {h} percent, {Away} {a} percent, gap {g} points. Rule: one team above {high} and the other below {low}. {Qualifies | Does not qualify}." Shown as a text sentence below as well (see Step 11.1), so no information is visual-only.
- Height budget 96px (hero bottom area); on mobile the track is full width with labels 12px; never shown on the card (cards keep the two FormBars).

## 34. Orientation aids — day groups and freshness pill
**Day group headers (dashboard "Upcoming" tab only):** results are grouped by local date in the owner's timezone; each group has a header row — date label ("Tomorrow · Wed 4 Nov", "Today · Tue 3 Nov", else "Thu 5 Nov"; h3 17/600) + a count pill (mono 12) + a 1px `--hairline` line filling the remaining width; group spacing 32px (header → cards 16px). Single-day tabs (Today/Tomorrow/Day after) show **no** group header (the tab already says it). Headers are not sticky; they are `<h2>`-level landmarks for screen readers (`aria-labelledby` on each grid section).
**Freshness pill (navbar):** ≥1024px between the nav links and Logout; <1024px inside the mobile sheet header area. 32px tall pill, hairline border, padding 0 12px: status dot 8px (`--positive` if updated within staleAfter/2, `--warning` if stale, `--text-faint` if never) + text "Updated 2 h ago" (14px, mono for the number) ; click → `/runs`; tooltip (hover/focus) shows the exact time "Today 06:58"; aria-label "Data last updated Today 06:58. View run history."; recalculates every 60 s; shows "No data yet" when never updated; during RUNNING shows a pulsing lime dot and "Checking…". The initial value comes from the server in the `(app)` layout (no client flash).

## 35. Large-screen and ultra-wide treatments
- Container stays centred (1440 → 1680 at ≥1920); beyond that the extra width is **background**, not content.
- At ≥1920px add a subtle **vignette** (radial gradient, transparent centre → `rgba(0,0,0,.25)` at the edges) and keep the hero glow anchored to the *container's* top centre, so the page never looks empty or stretched at 2560.
- Type sizes use `clamp()` capped at the stated maxima (no further growth); cards stay 320–420px wide; grid gap max 24px.
- At 2560×1440 the dashboard should show ≥ 4 cards per row without scrolling horizontally and without any element wider than 1680px (except the background layers).

## 36. Dialog and modal wireframes (not covered elsewhere)
```
CONFIRM (440w)                         TOKEN CREATED (480w)                    RUN DETAILS (560w)
┌────────────────────────────┐        ┌──────────────────────────────┐       (see §8)
│ Revoke "Home laptop"?   ✕  │        │ Token created            ✕   │
│ The helper using it will   │        │ ┌──────────────────────────┐ │
│ stop working.              │        │ │ scr_9fK2…x7Q   [⧉ Copy]  │ │ mono box, break-all
│            [Cancel][Revoke]│        │ └──────────────────────────┘ │
└────────────────────────────┘        │ ⚠ Copy it now — you won't    │ warning callout
Mobile: bottom sheet, handle,         │   see it again.              │
buttons stacked (primary first).      │ [ Done ] (enabled after copy │
                                      │  or 3 s)                     │
                                      └──────────────────────────────┘
```
- Dialog header: title h3 left, close 44×44 right; body padding 24; footer buttons right-aligned (desktop) / stacked (mobile). Initial focus: first field, or the least destructive button for confirms (never the destructive one). Esc closes unless the dialog is mid-request; scrim click closes non-destructive dialogs only.
