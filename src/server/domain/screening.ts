import type { FormScope, Probabilities, ScreeningResult } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * PRECONDITION: the thresholds passed `validateThresholds`. Form values are already rounded to 2 decimals
 * by `normalizePercent`, so 75.004 is stored as 75 and does not qualify (documented decision).
 *
 * The client's rule, with STRICT inequalities and either side allowed to be the strong one:
 *   (home > high AND away < low)  OR  (away > high AND home < low)
 * Both-high, both-low and middling pairs never qualify. `formGap` is always computed.
 */
export function evaluateMatch(
  match: { homeFormPct: number; awayFormPct: number },
  thresholds: { high: number; low: number },
): ScreeningResult {
  const { homeFormPct: home, awayFormPct: away } = match;
  const formGap = round2(Math.abs(home - away));
  if (home > thresholds.high && away < thresholds.low) {
    return { qualifies: true, strongSide: "HOME", formGap };
  }
  if (away > thresholds.high && home < thresholds.low) {
    return { qualifies: true, strongSide: "AWAY", formGap };
  }
  return { qualifies: false, strongSide: null, formGap };
}

export type ThresholdCheck = { ok: true } | { ok: false; reason: string };

/** 0 ≤ low < high ≤ 100, both integers. */
export function validateThresholds(t: { low: number; high: number }): ThresholdCheck {
  if (!Number.isInteger(t.low) || !Number.isInteger(t.high)) {
    return { ok: false, reason: "Thresholds must be whole numbers." };
  }
  if (t.low < 0 || t.high > 100) {
    return { ok: false, reason: "Thresholds must be between 0 and 100." };
  }
  if (t.low >= t.high) {
    return { ok: false, reason: "The lower threshold must be below the upper threshold." };
  }
  return { ok: true };
}

/** "No" for both-teams-to-score, derived as 100 − Yes (never stored). */
export const bttsNo = (p: Pick<Probabilities, "btts">): number | undefined =>
  p.btts === undefined ? undefined : round2(100 - p.btts);

/** "Under 2.5", derived as 100 − Over (never stored). */
export const under25 = (p: Pick<Probabilities, "over25">): number | undefined =>
  p.over25 === undefined ? undefined : round2(100 - p.over25);

/** Returns a human reason when the match was measured on a different form scope than the setting. */
export function checkFormScope(
  match: { formScope: FormScope },
  expected: FormScope,
): string | null {
  return match.formScope === expected ? null : `form scope mismatch: expected ${expected}`;
}
