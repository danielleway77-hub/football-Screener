# Step 15.2 — screen-by-screen critique and elevation

Role: senior product designer reviewing a data-scanning tool for ONE daily user (phone + laptop).
Evidence: `docs/reference/polish/before/*.png` (before this step) and `docs/reference/polish/after/*.png` (after), 360/768/1280/1920.
Effort: L = low, M = medium, H = high. **Bold** = implemented in this step (token-only, no new colour or library, behaviour unchanged).

## Dashboard

1. Hierarchy: "Qualifying now 3" is the biggest number; scanning order is right.
2. Density: bento row plus run panel plus filter bar before the first card is a lot on a phone (first card is below the fold at 360).
3. Rhythm: 4px scale holds; section gaps consistent.
4. State clarity: SUCCESS/stale/failed panel is clear; filter result count is small and right-aligned.
5. Consistency: tiles share one recipe with the cards.
6. Premium or template: calm and distinct (lime used for meaning), no template tells.

Improvements: (1) **numbers on cards larger than the team name (L)**; (2) **"Next kickoff" never splits a number across lines (L)**; (3) phone: collapse the bento to two rows (M, deferred: changes layout, needs owner approval); (4) show the count next to the filter bar on mobile (L, deferred); (5) skeleton for the bento (M, exists).

## MatchCard

1. Hierarchy: the percentage was 14px while the team name was 17px (violates "numbers largest after h1").
2. Density: five rows in a fixed 4px-grid card; fine.
3. Rhythm: heights come from `dimensions.ts`, no jumps.
4. State clarity: strength word + icon + colour (never colour only).
5. Consistency: same FormBar on card and detail.
6. Premium: glow only on qualifying cards; **sheen** now travels the hairline of qualifying cards while on screen.

Improvements: (1) **pill number 18px mono (L)**; (2) **spotlight on hover-capable pointers (L, 15.4)**; (3) **border sheen for qualifying cards only (M, 15.1)**; (4) tick labels on the card bar (M, deferred: needs height change); (5) team-logo skeleton fidelity (L, exists).

## Match detail

1. Hierarchy: the verdict chip, teams and duel read in order; predicted score is the largest number.
2. Density: generous; the hero's duel occupied only the left 640px of a 1100px card.
3. Rhythm: consistent.
4. State clarity: duel zones labelled, "gap N pts" explicit.
5. Consistency: probability tiles repeat the card patterns.
6. Premium: yes.

Improvements: (1) **centre the FormDuel inside the hero so the card is balanced (L)**; (2) swap card order so probabilities come first on phones (M, deferred); (3) sticky Back/Next on phones (M, deferred); (4) label thresholds on the duel in the accessible text (exists); (5) hover states on tiles (L, none needed).

## Login

1. Hierarchy: logo, heading, field, button: clear.
2. Density: spacious; 420px card on desktop, open column on phones.
3. Rhythm: 32px between blocks.
4. State clarity: error, lockout and offline all explicit.
5. Consistency: same Input/Button.
6. Premium: **entrance choreography (GSAP) and ambient glow** raise it without delaying the form (content is in the first paint).

Improvements: (1) **staggered entrance (15.1)**; (2) **pitch-glyph draw-on (15.1)**; (3) ambient glow 8% (15.1); (4) show/hide password affordance (exists); (5) remember-me: rejected (single-user, security).

## Runs / Import / Settings

Runs: table to cards at md, status chips with icon + text, details dialog: clear; improvement (**content-visibility rows, L**). Import and Settings pages are built by Step 13 on another branch: they are polished through the shared components (Button, Input, Switch, Dialog, Sheet, StickyBar, Toast) only; their own critique runs after the merge (pending).

## 404 / error / offline

Inline-SVG illustrations, copy in the §16 tone, no external requests: no change needed. Toast, dialog and sheet timings now follow §12 (240/240/280ms).

## Re-score (UI_BLUEPRINT §17)

See `docs/TEST_LOG.md` (Step 15 evidence): dashboard 19/20, detail 19/20, login 19/20, runs 18/20.
