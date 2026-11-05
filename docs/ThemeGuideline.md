# ThemeGuideline.md — Single visual reference (v2)

**Rule for agents:** every colour, font, size, spacing, radius, shadow and motion value in the UI comes from this file via CSS variables. Never hard-code values in components. If you need something that isn't here, add it here first (and tell the owner).

---

## 1. Theme direction and why

**Name:** *Night Pitch* — a dark, calm "control room" with one disciplined neon-lime accent.

**Why this fits the product**
| Product fact | Design consequence |
|---|---|
| Owner checks numbers (%) for hours/day today; the tool should make scanning effortless | Dense-but-calm data UI, strong numeric typography (mono, tabular), generous spacing between cards, no decoration that competes with numbers |
| She already works inside PrediGoal's dark neon-lime UI (client screenshot) | Same visual family → familiar, trusted; we refine it (calmer surfaces, tighter hierarchy, better contrast) rather than copy it |
| The whole product answers one question: "does this match qualify?" | Lime is **reserved** for "qualifies / primary action / positive signal". Everything else is neutral. When she sees lime, it means something |
| Used on phone and desktop, often in the evening | Dark theme reduces glare; large touch targets; mobile-first |
| Personal tool, not a marketing site | Premium and refined, but restrained: motion supports comprehension, never decorates |

**Research notes that shaped the palette** (web research, Nov 2026)
- Dashboard guidance: neutral base, bright colours **only** for emphasis, one colour per meaning; never colour alone to convey information ([Data School](https://www.thedataschool.co.uk/tobias-fitschen/dashboard-design-best-practices-color), [Amex data-viz color guidance](https://designinternet-qaeusw1green.americanexpress.com/guidelines/data-visualization/color)).
- Dark theme guidance: avoid heavily saturated colours for text; check contrast on **every elevation level**, not just the page background ([Material dark theme](https://m2.material.io/design/color/dark-theme)). → we use lime only for fills/large accents/icons, body text is neutral.
- Dark mode does not automatically meet WCAG; contrast must be verified per token ([BOIA](https://boia.org/blog/offering-a-dark-mode-doesnt-satisfy-wcag-color-contrast-requirements)). → all tokens below were measured (see §2.6).
- Football form guides: add a **letter (W/D/L) and shape** in addition to colour for red/green colour-blind users ([BBC football tables case](https://wearecolorblind.com/examples/bbc-online-football-tables/), [visualisingdata](https://visualisingdata.com/?p=16602)). → W/D/L letters + ↑/↓ strength icons are mandatory.

**Alternatives considered and rejected**
| Option | Verdict |
|---|---|
| Blue/white corporate dashboard | Generic; clashes with the client's familiar PrediGoal look; weaker "signal" colour |
| Green-on-green "pitch" theme | Low contrast between states; green already means W/positive in form badges |
| Purple/gradient "AI" look | Trendy, but unrelated to football/data scanning |
| Pure black (#000) | Harsh on OLED, bad smear on scroll, no elevation range. We use green-tinted near-black |
| **Night Pitch (chosen)** | Neutral green-black base + single lime accent + coral for weak + cool blue for info |

**Not supported in v1:** light theme (document in README; `color-scheme: dark` set globally). Tokens are structured so a light theme can be added later.

---

## 2. Color system

### 2.1 Neutrals (surfaces & text)
| Token | Hex | Use |
|---|---|---|
| `--bg-base` | `#070A09` | page background |
| `--bg-subtle` | `#0B100E` | input fills, section alternation |
| `--surface` | `#0E1513` | cards (elevation 1) |
| `--surface-raised` | `#151D1A` | hovered cards, popovers, dropdowns (elevation 2) |
| `--surface-overlay` | `#1B2521` | dialogs, sheets (elevation 3) |
| `--scrim` | `rgba(4,6,5,0.72)` | modal backdrop + `backdrop-filter: blur(8px)` |
| `--border` | `#1F2A26` | decorative dividers/card borders (not required to meet 3:1) |
| `--border-strong` | `#2C3B35` | stronger separators |
| `--border-control` | `#55695F` | **input/checkbox/switch outlines** (≥ 3:1 per WCAG 1.4.11) |
| `--text` | `#F2F7F4` | primary text |
| `--text-muted` | `#9AABA4` | secondary text |
| `--text-faint` | `#7C8E87` | tertiary/meta (≥ 4.5:1 on all surfaces) |
| `--text-disabled` | `#566761` | disabled only (exempt from contrast, always paired with disabled styling) |
| `--text-on-accent` | `#0A1000` | text on lime |

### 2.2 Brand and accents
| Token | Hex | Use |
|---|---|---|
| `--primary` | `#C8F52E` | the one accent: primary buttons, qualifies, active nav, focus ring, strong-form bar |
| `--primary-hover` | `#D9FF55` | hover |
| `--primary-active` | `#A9D61A` | pressed |
| `--primary-soft` | `rgba(200,245,46,0.12)` | chip/pill backgrounds |
| `--primary-border` | `rgba(200,245,46,0.38)` | accent outlines |
| `--primary-glow` | `rgba(200,245,46,0.28)` | glow shadows (qualifying card, CTA hover only) |
| `--secondary` | `#18221E` | secondary button fill |
| `--secondary-hover` | `#212E29` | secondary hover |

### 2.3 Semantic colors (each has a **text** variant and a **soft** background)
| Meaning | Token | Hex | Soft bg | Icon/shape cue |
|---|---|---|---|---|
| Positive / strong form / win | `--positive` | `#2EE59D` | `rgba(46,229,157,0.14)` | ↑ arrow / check / letter W |
| Negative / weak form / loss | `--negative` | `#FF6B6B` | `rgba(255,107,107,0.14)` | ↓ arrow / x / letter L |
| Neutral / draw | `--neutral-signal` | `#9AABA4` | `rgba(154,171,164,0.16)` | – dash / letter D |
| Warning / stale | `--warning` | `#FFB547` | `rgba(255,181,71,0.14)` | triangle |
| Info / helper | `--info` | `#5CC8FF` | `rgba(92,200,255,0.14)` | circle-i |
| Confidence (accent for meter only) | `--violet` | `#A78BFA` | `rgba(167,139,250,0.14)` | – |
Mapping rule: **lime = qualifies/primary**; **emerald = a "W" result**; they're deliberately different hues so "qualifies" never reads as "won".

### 2.4 State colors
| State | Rule |
|---|---|
| Hover | surfaces → next elevation; primary → `--primary-hover`; ghost → `rgba(255,255,255,0.05)` |
| Active/pressed | scale 0.98; primary → `--primary-active` |
| Focus-visible | `box-shadow: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--primary)`; on lime backgrounds use `0 0 0 2px var(--bg-base), 0 0 0 4px #FFFFFF` |
| Disabled | opacity .45, `--text-disabled`, `cursor: not-allowed`, no hover/glow, `aria-disabled` |
| Selected | `--primary-soft` bg + `--primary-border` |
| Error field | border `--negative` + message with icon |
| Success field | border `--positive` |
| Loading | skeleton shimmer; buttons show spinner and keep width |

### 2.4b Additional named tokens (define all in `globals.css`)
`--positive-soft: rgba(46,229,157,.14)` · `--negative-soft: rgba(255,107,107,.14)` · `--warning-soft: rgba(255,181,71,.14)` · `--info-soft: rgba(92,200,255,.14)` · `--violet-soft: rgba(167,139,250,.14)` · `--neutral-soft: rgba(154,171,164,.16)` · `--skeleton: #141C19` · `--track: #18221E` (form-bar/progress track) · `--neutral-bar: #6F8A80` (average form fill) · `--shimmer` (gradient below) · `--ring-offset: var(--bg-base)`.

### 2.4c Depth tokens ("quiet precision" — see `UI_BLUEPRINT.md` Part 2, §20–§21)
`--hairline: rgba(255,255,255,.08)` (default 1px outline on dark surfaces) · `--hairline-strong: rgba(255,255,255,.14)` (hover/raised) · `--inner-highlight: inset 0 1px 0 rgba(255,255,255,.04)` · `--glass-bg: color-mix(in srgb, var(--bg-base) 78%, transparent)` · `--spotlight: radial-gradient(240px circle at var(--mx) var(--my), rgba(200,245,46,.10), transparent 60%)`. Utility classes: `.surface-1` (cards), `.surface-2` (tiles/popovers), `.surface-3` (dialogs/sheets), `.glass` (navbar, sticky bars, sheets headers), `.num` (tabular numerals: `font-variant-numeric: tabular-nums slashed-zero`). **Rule:** borders (hairlines) define surfaces; shadows only on floating layers. Lime budget < 3% of a screen's pixels. Radius ladder 8 · 12 · 16 · 20 · 24 · 999 only. Dense UI text 14px, controls 15px, prose 16px, mobile inputs 16px.

### 2.4d Implementation notes (verified in Step 2)
- **Tailwind names:** page colour is `bg-canvas` (never `base`: it collides with the `text-base` font-size utility). Others: `bg-subtle`, `bg-surface`, `bg-surface-raised`, `bg-surface-overlay`, `border-hairline`, `border-hairline-strong`, `border-border-control`, `text-faint`, `bg-primary-soft`, `border-primary-border`, `bg-track`, `bg-skeleton`.
- **Fonts** are self-hosted Fontsource variable fonts loaded with `next/font/local` (no Google dependency): families appear as `spaceGrotesk`, `inter`, `jetbrains` in computed styles.
- **Focus:** a global `:focus-visible` outline (2px `--primary`, offset 2px; white on lime buttons). Components must NOT use `outline-none`.
- **Button sizes:** default 44 · sm 36 · lg 52 (xs 32, icons 32–52). Checkbox 20px (8px radius); slider thumb 20px lime.
- **`pnpm contrast`** checks 24 pairs from these tokens; `--text-faint` is `#7C8E87` (4.56:1 on `--surface-overlay`).

### 2.5 Gradients and effects
- `--grad-hero`: `radial-gradient(60% 50% at 18% 0%, rgba(200,245,46,.09), transparent 70%), radial-gradient(45% 40% at 92% 8%, rgba(46,229,157,.06), transparent 70%)`
- `--grad-card`: `linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,0) 60%)`
- `--grad-accent-border`: `linear-gradient(135deg, rgba(200,245,46,.65), rgba(200,245,46,0) 45%)` (qualifying card hairline)
- `--shimmer`: `linear-gradient(90deg, transparent, rgba(255,255,255,.06), transparent)`
- Noise: 3% opacity static SVG over `--bg-base` (no animation).
- Shadows: `--shadow-sm: 0 1px 2px rgba(0,0,0,.45)` · `--shadow-md: 0 10px 28px -10px rgba(0,0,0,.6)` · `--shadow-lg: 0 28px 64px -16px rgba(0,0,0,.7)` · `--glow-accent: 0 0 0 1px var(--primary-border), 0 0 36px -8px var(--primary-glow)`.

### 2.6 Measured contrast (WCAG 2.x relative luminance)
| Pair | Ratio | Result |
|---|---|---|
| text on bg / surface / raised | 18.4 / 17.1 / 15.9 | AAA |
| text-muted on bg / surface / raised | 8.3 / 7.7 / 7.2 | AAA |
| text-faint (`#7C8E87`) on bg / surface / raised / overlay | 5.75 / 5.35 / 4.97 / 4.56 | AA — verified by `pnpm contrast` (history: `#73857E` = 4.40 ✗, `#7B8D86` = 4.498 ✗ on overlay; do not use faint text on anything lighter than overlay) |
| primary on bg / surface | 15.7 / 14.6 | AAA |
| text-on-accent on primary | 15.2 | AAA |
| negative on surface | 6.7 | AA |
| positive / warning / info on surface | 11.3 / 10.5 / 9.8 | AAA |
| border-control (`#55695F`) vs bg-subtle | 3.26 | passes 3:1 (adjusted from `#3A4D45` = 2.13 ✗) |
| primary vs negative | 2.2 | **fails to distinguish by colour alone → arrows, labels and letters are mandatory** |
Agents must re-run a contrast check (script in repo `scripts/contrast.mjs`) whenever a token changes.

### 2.7 Data-viz palette (charts/meters/segments)
Ordered, colour-blind-considered (differ in lightness as well as hue): `#C8F52E` (primary series) · `#5CC8FF` · `#FFB547` · `#A78BFA` · `#FF6B6B` · `#9AABA4` (neutral/other). Always label directly or add patterns/icons; never rely on hue alone. Probability tiles use **one** colour (lime) for the highest of the 1X2 trio and neutral for the rest — no rainbow.

---

## 3. Typography
Fonts via `next/font/google` (`display: swap`, subsets latin):
| Role | Font | Weights | Variable | Use |
|---|---|---|---|---|
| Heading | **Space Grotesk** | 500, 600, 700 | `--font-heading` | titles, nav brand, stat labels |
| Body | **Inter** | 400, 500, 600 | `--font-body` | text, forms, tables |
| Numeric | **JetBrains Mono** | 500, 600 | `--font-mono` | all %, times, ids (`font-variant-numeric: tabular-nums`) |
Fallback stacks: `system-ui, -apple-system, "Segoe UI", sans-serif`; mono → `ui-monospace, "SF Mono", Consolas, monospace`.

| Token | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| `display` | clamp(2.25rem, 5vw, 3.75rem)/1.05 | 700 | -0.02em | rare hero numbers |
| `h1` | clamp(1.75rem, 3.2vw, 2.5rem)/1.15 | 700 | -0.015em | page title |
| `h2` | 1.5rem/1.25 | 600 | -0.01em | sections |
| `h3` | 1.25rem/1.3 | 600 | 0 | card titles |
| `h4` | 1.0625rem/1.4 | 600 | 0 | sub-titles |
| `body` | 1rem/1.6 | 400 | 0 | default |
| `body-sm` | 0.875rem/1.5 | 400 | 0 | secondary |
| `caption` | 0.75rem/1.4 | 500 | 0.04em | meta |
| `overline` | 0.75rem/1.2 | 600 | 0.14em, uppercase | labels like "RECENT FORM" |
| `stat-xl` | clamp(2rem,5vw,3rem)/1 mono | 600 | -0.02em | dashboard hero numbers |
| `stat` | clamp(1.5rem,3vw,2rem)/1 mono | 600 | -0.01em | probabilities |
| `stat-sm` | 1rem/1 mono | 600 | 0 | pills |
Rules: max line length 70ch for prose; inputs ≥ 16px on mobile; no text below 12px; headings never all-caps except `overline`; team names truncate with ellipsis + `title` tooltip (never wrap more than 2 lines).

---

## 4. Spacing, radius, layout, z-index
- **Spacing scale (4px base):** 4, 8, 12, 16, 20, 24, 32, 40, 56, 72, 96. Card padding 16 (mobile) → 24 (desktop). Gap between cards 16 → 24.
- **Section padding:** 40 mobile / 56 tablet / 72 desktop.
- **Radius:** sm 8 · md 12 (controls) · lg 16 (cards) · xl 24 (hero panels, dialogs 20) · pill 999.
- **Container:** content 1280; wide (dashboard) 1440 below 1920px and **1680 at ≥1920px**; gutters 16/24/32; always centered. Cards never exceed ~420px wide and never drop below 320px.
- **Breakpoints:** 360 (min design) · 640 sm · 768 md · 1024 lg · 1280 xl · 1536 2xl · 1920 3xl (custom). Tailwind v4: declare `--breakpoint-3xl: 120rem;` inside `@theme`; v3: `screens.3xl` in config.
- **Grids:** match cards 1 col <768, 2 cols 768–1279, 3 cols 1280–1919, 4 cols ≥1920 (1680 container ÷ 4 ≈ 400px cards). At 2560 the container stays 1680 centered.
- **Touch targets:** ≥ 44×44; spacing between adjacent targets ≥ 8.
- **Z-index scale:** base 0 · sticky nav 40 · dropdown/popover 50 · sheet/dialog 60 · toast 70 · route progress 80 · skip-link 90.
- **Safe areas:** respect `env(safe-area-inset-*)` for sticky bars on iOS.

---

## 5. Iconography
`lucide-react`, stroke 1.75, sizes 16 / 20 / 24, inherit text colour. Icon map (use consistently): Dashboard `LayoutGrid` · Runs `History` · Import `Download`/`UploadCloud` · Settings `SlidersHorizontal` · Qualifies `BadgeCheck` · Strong form `TrendingUp` · Weak form `TrendingDown` · Kickoff `Clock` · League `Trophy` · Source link `ExternalLink` · Stale `AlertTriangle` · Offline `WifiOff` · Success `CheckCircle2` · Error `XCircle` · Info `Info` · Refresh `RefreshCw` · Logout `LogOut` · Token `KeyRound` · Copy `Copy`. Decorative icons `aria-hidden`; icon-only buttons get `aria-label`.

---

## 6. Components (spec)
### 6.1 Buttons
| Variant | Fill | Text | Border | Hover | Active | Notes |
|---|---|---|---|---|---|---|
| primary | `--primary` | `--text-on-accent` | none | `--primary-hover` + `--glow-accent` + sheen sweep | `--primary-active` scale .98 | the only lime-filled control per view section |
| secondary | `--secondary` | `--text` | `--border-strong` | `--secondary-hover` | scale .98 | |
| ghost | transparent | `--text-muted` | none | bg `rgba(255,255,255,.05)`, text `--text` | | toolbar actions |
| destructive | `--negative` @14% | `--negative` | `--negative` @40% | bg @22% | | confirm dialog required |
| link | none | `--primary` | – | underline | | inline |
Heights sm 36 / md 44 / lg 52; radius 12; label 15px/600; icon gap 8. Loading: spinner replaces icon, width locked, `aria-busy`.
### 6.2 Cards
`--surface` + `--grad-card`, 1px `--border`, radius 16, `--shadow-sm`. Hover (interactive cards): border `--border-strong`, translateY(-2px), `--shadow-md`. **Qualifying match card:** `--grad-accent-border` hairline + low `--glow-accent` + "QUALIFIES" chip. Cards are **never nested** more than one level.
*Gradient-border technique:* `border-image` breaks with `border-radius`. Use a `::before` pseudo-element with `padding:1px; background: var(--grad-accent-border); border-radius: inherit; mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude;` (and `-webkit-mask-composite: xor`), `pointer-events:none`. Implement once as a reusable `.accent-border` utility.
### 6.3 FormBar (signature)
Track `#18221E`, height 8, pill. Fill animates 0→value in 700ms `--ease-out`. Colour by strength relative to settings: **strong** (> high) lime + `TrendingUp` + label "Strong form"; **weak** (< low) `--negative` + `TrendingDown` + label "Poor form"; **mid** `#6F8A80` + label "Average". Numeric pill (mono) at right. Tick marks on the track at the low/high thresholds (35 / 75) so the owner sees *why* it qualifies. Never colour-only: label and icon always present.
### 6.4 FormBadges (last results)
Square 28px radius 8; letter **W/D/L** centered (bold 12px); W = `--positive` on soft, D = neutral, L = `--negative`; `aria-label="Win"` etc.; most recent on the right.
### 6.5 Probability tiles
Mirrors the client's PrediGoal **"Exact probabilities"** panel (image #2) using our tokens. Three building blocks: **(1) single-value tile** (the 1X2 trio in cards): overline label, `stat` mono value; the highest of the three gets lime value + soft lime bg + a small "Highest" label (never colour only); ties or any missing 1X2 value → no highlight. **(2) PairTile** (Both teams to score Yes/No; Over/Under 2.5): two labelled values side by side, the **larger in `--primary`**, the smaller in `--text`, equal → neither lime; "No" and "Under" are derived (100 − Yes / 100 − Over) and labelled as such for assistive tech. **(3) Bar row** (detail panel): label + mono value pill + 8px bar on `--track`, lime fill for the highest row, `--neutral-bar` for the others, 700ms fill with 60ms stagger. Missing → "Unavailable" with `Info` icon and dashed border, never 0%. **Predicted score:** mono 600 (14px in cards, 48px hero on detail) with a 12px "AI" micro-chip (`--violet-soft` bg, `--violet` text). Layout: inside MatchCard = **compact** (3 single tiles + 2 pair tiles, all widths); detail page = **ProbabilityPanel** (predicted-score hero, three bar rows, two pair rows) — see `UI_BLUEPRINT.md` §5 and §7.
### 6.6 Inputs & forms
Height 44, fill `--bg-subtle`, border `--border-control`, radius 12; hover border brighter (`#6C8277`); focus ring; error: border `--negative` + inline message (icon + text, `aria-describedby`); labels above (body-sm 500); helper text `--text-faint`; switches/sliders: lime thumb/track with ≥3:1 outline; selects/combos themed dark (no native white popups); dual-threshold slider shows the two numbers as pills.
### 6.7 Navigation
Sticky 64px, `--bg-base` @ 80% + blur(12px), bottom border `--border`. Brand left; links right (Dashboard, Runs, Import, Settings, Logout). Active link: `--text` + 2px lime pill underline sliding via Framer `layoutId`. <768: hamburger → right-side Sheet with 56px tall link rows; no bottom tab bar (avoid duplicate nav). Skip-to-content link first in tab order.
### 6.8 Chips & badges
Pill, caption size, soft bg + matching text + 1px translucent border + icon. Status chips: RUNNING (pulsing lime dot), SUCCESS (positive), PARTIAL (warning), FAILED (negative), STALE (warning), SKIPPED (neutral).
### 6.9 Tables
Desktop: sticky header `--bg-subtle`, row height 56, hover `rgba(255,255,255,.03)`, numeric columns right-aligned mono. <768: rows become stacked cards with label/value pairs.
### 6.10 Dialogs, sheets, toasts
Dialog radius 20, `--surface-overlay`, `--shadow-lg`, scrim; <640 dialogs become bottom sheets with drag handle. Toasts (sonner): top-center on mobile **offset 72px so they sit below the sticky nav**, bottom-right desktop, 4s (errors 8s, with Retry), icon + text, `aria-live`; max 3 stacked.
**Tooltips:** hover/focus only, supplementary. **Never put essential information or the only reason for a disabled control in a tooltip** (touch users can't see it). Disabled controls show the reason as visible helper text under/next to the control; tooltip may repeat it.
### 6.11 Skeletons
Fill `#141C19` + shimmer 1.6s; shapes mirror the final layout exactly (same heights) to avoid CLS; reduced-motion → static fill.
### 6.12 Empty / error states
64px soft-lime circle with icon (error: soft-negative), h3, muted description (max 2 lines), one primary action (+ optional secondary). Copy tone §9.
### 6.13 Banners
Offline (warning), Stale (warning), Back online (success, auto-hides 3s). Full width under nav, 44px high, icon + text + action, `role="status"`.

---

## 7. Animation system
Libraries: **Framer Motion** (default: UI, layout, page, lists) · **GSAP** (login entrance timeline only, dynamic import) · **Animate.css** only if a trivial keyframe is needed (prefer none; remove dependency if unused).
- Easings: `--ease-out: cubic-bezier(.22,1,.36,1)` · `--ease-in-out: cubic-bezier(.65,0,.35,1)` · spring `{stiffness:380,damping:30}`.
- Durations: micro 120–180ms · UI 240–320ms · reveal 500–700ms · page 350ms · count-up 800ms · bar fill 700ms.
- Page transition: opacity + 8px translateY. Lists: stagger 60ms (max 8 items animated). Reveal once on view (`margin: -10%`).
- Numbers count up once on first view; digits are tabular so layout never jitters.
- Primary button: 600ms sheen sweep on hover (CSS). Qualifying card: faint rotating border sheen 6s (CSS mask, paused when offscreen, disabled for reduced motion).
- Loading: skeleton shimmer, 2px lime route progress bar, status-chip pulse. **Only** these may loop forever.
- Tailwind note: in Tailwind v4 expose tokens with `@theme inline { --color-surface: var(--surface); … }` so utilities like `bg-surface`, `text-muted`, `border-border-control` exist; in v3 map them in `tailwind.config`. Never duplicate hex values in both places.
- Rules: animate `transform` and `opacity` (plus bar width); no layout-property animation; no interaction animation > 1s; `prefers-reduced-motion: reduce` → no translate/stagger/count-up/sheen/pulse/route-progress animation (progress shows as a static bar), opacity fades ≤ 150ms, and status "pulse" becomes a static dot; never block content with animation (content readable at t=0).

## 8. Responsive & page patterns
- **Mobile (360–767):** single column; stats strip as 2-col grid; filters in a horizontally scrollable chip row + "Sort" dropdown; cards full width; Settings uses sticky bottom save bar; tables → cards; dialogs → bottom sheets.
- **Tablet (768–1023):** 2-col cards; nav inline; settings 1 col with wider cards.
- **Laptop/desktop (1024–1919):** 3-col cards ≥1280; settings 2-col (nav list + form); detail page 2-col hero.
- **Large (≥1920):** centered 1680 container, 4-col cards; larger type via clamp, not by stretching; 2560 stays centered with the same container (no stretched layouts).
- Page layouts: **Dashboard** = SectionHeader + RunStatusPanel + Stats strip + Filters + Grid. **Detail** = breadcrumb + hero + FormBars + ProbabilityGrid + meta. **Runs** = SectionHeader + filters + table. **Settings** = stacked cards. **Login** = centered card over `--grad-hero`.

## 9. Voice and microcopy
Short, plain, factual. Numbers first.
- Empty: "No matches met 75% / 35% for tomorrow. 42 scanned at 06:58."
- Stale: "Data is 31 hours old. Update to see today's matches."
- Error: "Couldn't load matches. Check your connection and try again." (+ Retry)
- Success toast: "3 qualifying matches found."
- Buttons are verbs: "Run now", "Update data", "Save changes", "Re-screen matches".
Never use betting-advice language ("tip", "guaranteed", "sure win"). Show a small footer note: "Probabilities are provided by the data source; this tool does not give betting advice."

## 10. Brand assets
Wordmark "SCREENER" (Space Grotesk 700, tracking 0.12em) + glyph: a minimal pitch centre-circle with a lime filter-line crossing it (SVG, 24px, single colour). Favicon: lime glyph on `--bg-base` rounded square. OG image: dark with glyph + "Football Match Screener". `theme-color` `#070A09`. Team logos from data; fallback = initials on `--surface-raised` circle.

## 11. Ready-to-paste tokens (`globals.css` seed)
```css
:root {
  color-scheme: dark;
  --bg-base:#070A09; --bg-subtle:#0B100E; --surface:#0E1513; --surface-raised:#151D1A; --surface-overlay:#1B2521;
  --scrim:rgba(4,6,5,.72); --border:#1F2A26; --border-strong:#2C3B35; --border-control:#55695F;
  --text:#F2F7F4; --text-muted:#9AABA4; --text-faint:#7C8E87; --text-disabled:#566761; --text-on-accent:#0A1000;
  --primary:#C8F52E; --primary-hover:#D9FF55; --primary-active:#A9D61A;
  --primary-soft:rgba(200,245,46,.12); --primary-border:rgba(200,245,46,.38); --primary-glow:rgba(200,245,46,.28);
  --secondary:#18221E; --secondary-hover:#212E29;
  --positive:#2EE59D; --negative:#FF6B6B; --neutral-signal:#9AABA4; --warning:#FFB547; --info:#5CC8FF; --violet:#A78BFA;
  --radius-sm:8px; --radius-md:12px; --radius-lg:16px; --radius-xl:24px;
  --ease-out:cubic-bezier(.22,1,.36,1); --ease-in-out:cubic-bezier(.65,0,.35,1);
}
```
Map to shadcn semantic variables: `--background=--bg-base`, `--foreground=--text`, `--card=--surface`, `--popover=--surface-raised`, `--primary=--primary`, `--primary-foreground=--text-on-accent`, `--secondary=--secondary`, `--muted=--bg-subtle`, `--muted-foreground=--text-muted`, `--accent=--surface-raised`, `--destructive=--negative`, `--border=--border`, `--input=--border-control`, `--ring=--primary`.

## 12. Do / Don't
**Do:** use lime sparingly (one primary action per area; qualifies; active); show thresholds on bars; pair every colour with a label/icon; keep cards flat and quiet; let numbers be the largest thing on the card.
**Don't:** use lime for decoration, big gradients, glassmorphism everywhere, more than one glow on screen section, neon text for paragraphs, red/green only distinctions, animations that delay reading, stock photos, betting-flavoured imagery.

## 13. Theme QA checklist (run each UI step)
[ ] No hex values outside `globals.css` [ ] Fonts correct & no FOUT shift [ ] Focus ring visible on every control [ ] Contrast script passes [ ] W/D/L letters + strength icons present [ ] Reduced-motion verified [ ] 360/768/1280/1920 reviewed [ ] Skeleton heights match final [ ] Lime used only for meaning [ ] shadcn popups/selects themed (no white flashes)
