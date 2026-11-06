/** Pure layout rules for FormDuel (no React). Percent in, percent out. */

/** Markers stay inside the track: 2 to 98 percent. */
export const clampPos = (pct: number) => Math.min(98, Math.max(2, pct));

/** Markers closer than this (in form points) would overlap: the lower-valued one moves below the track. */
export const OVERLAP_PCT = 8;
/** Value labels closer than this are pushed apart (lower label ends at its marker, higher starts at its). */
export const LABEL_PCT = 14;
/** Below this span the "gap" pill does not fit on the bracket and moves to the bottom row. */
export const PILL_FITS_PCT = 50;

export type DuelSide = "home" | "away";

export type DuelLayout = {
  homeLeft: number;
  awayLeft: number;
  /** Which marker sits below the track (the lower-valued one) when they would overlap. */
  below: DuelSide | null;
  /** Value labels must be pushed apart. */
  spreadLabels: boolean;
  /** Higher-valued side. A tie counts as home higher. */
  higher: DuelSide;
  gap: number;
  /** Bracket spans from `from` to `to` (percent of the track). */
  from: number;
  to: number;
  pillOnBracket: boolean;
};

export function duelLayout(homePct: number, awayPct: number): DuelLayout {
  const homeLeft = clampPos(homePct);
  const awayLeft = clampPos(awayPct);
  const delta = Math.abs(homePct - awayPct);
  const higher: DuelSide = homePct >= awayPct ? "home" : "away";
  const lower: DuelSide = higher === "home" ? "away" : "home";
  return {
    homeLeft,
    awayLeft,
    below: delta < OVERLAP_PCT ? lower : null,
    spreadLabels: delta < LABEL_PCT,
    higher,
    gap: Math.round(delta * 100) / 100,
    from: Math.min(homeLeft, awayLeft),
    to: Math.max(homeLeft, awayLeft),
    pillOnBracket: Math.abs(homeLeft - awayLeft) >= PILL_FITS_PCT,
  };
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** The one sentence assistive tech reads (the visual is aria-hidden). */
export function duelAriaLabel(p: {
  homeName: string;
  awayName: string;
  homePct: number;
  awayPct: number;
  low: number;
  high: number;
  qualifies: boolean;
}): string {
  const gap = fmt(Math.abs(p.homePct - p.awayPct));
  return `${p.homeName} ${fmt(p.homePct)} percent, ${p.awayName} ${fmt(p.awayPct)} percent, gap ${gap} points. Rule: one team above ${p.high} and the other below ${p.low}. ${p.qualifies ? "Qualifies" : "Does not qualify"}.`;
}
