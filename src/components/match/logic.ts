/** Pure display rules for the match components (no React). Thresholds always come from settings. */

export type Strength = "strong" | "average" | "poor";

/** Strict, like the domain rule: exactly `high` or `low` is average. */
export function formStrength(pct: number, low: number, high: number): Strength {
  if (pct > high) return "strong";
  if (pct < low) return "poor";
  return "average";
}

export const STRENGTH_WORD: Record<Strength, string> = {
  strong: "strong",
  average: "average",
  poor: "poor",
};

export const STRENGTH_LABEL: Record<Strength, string> = {
  strong: "Strong form",
  average: "Average",
  poor: "Poor form",
};

/** Larger value of a pair wins; a tie (or a missing side) has no leader. */
export function pairLeader(a: number | null, b: number | null): "a" | "b" | null {
  if (a === null || b === null || a === b) return null;
  return a > b ? "a" : "b";
}

/** Highest of the 1X2 trio, only when all three are present and there is no tie for first. */
export function highest1x2(
  home: number | null,
  draw: number | null,
  away: number | null,
): "home" | "draw" | "away" | null {
  if (home === null || draw === null || away === null) return null;
  const max = Math.max(home, draw, away);
  const winners = [home === max, draw === max, away === max].filter(Boolean).length;
  if (winners !== 1) return null;
  return home === max ? "home" : draw === max ? "draw" : "away";
}

/** "No" / "Under" are derived (decision D12): 100 - value, one decimal at most. */
export function derived(value: number | null): number | null {
  if (value === null) return null;
  return Math.round((100 - value) * 10) / 10;
}

export function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}

/** Only W/D/L, at most the last five, oldest to newest. */
export function parseResults(raw: string | null | undefined): ("W" | "D" | "L")[] {
  if (!raw) return [];
  return raw
    .toUpperCase()
    .split("")
    .filter((c): c is "W" | "D" | "L" => c === "W" || c === "D" || c === "L")
    .slice(-5);
}
