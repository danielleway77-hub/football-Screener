/** Pure domain types. This folder imports nothing from Next, React, Prisma or any outer layer. */

export type FormScope = "league" | "overall";
export type Side = "HOME" | "AWAY";
export type Confidence = "LOW" | "MEDIUM" | "HIGH";
export type PercentScale = "percent" | "fraction";

export type Probabilities = {
  homeWin?: number;
  draw?: number;
  awayWin?: number;
  /** Probability of "Yes" (both teams to score). "No" is derived: see `bttsNo`. */
  btts?: number;
  /** Probability of "Over 2.5". "Under 2.5" is derived: see `under25`. */
  over25?: number;
};

export type TeamInput = {
  name: string;
  logoUrl?: string;
  /** 0–100 */
  formPct: number;
  /** Up to 5 characters of W/D/L, e.g. "WWDLW". */
  lastResults?: string;
};

/** A validated, normalised match as sent by a provider, helper or import. */
export type RawMatchInput = {
  provider: string;
  providerMatchId: string;
  sourceUrl?: string;
  /** An absolute instant (the input always carried Z or an explicit offset). */
  kickoffAt: Date;
  league?: string;
  country?: string;
  home: TeamInput;
  away: TeamInput;
  formScope: FormScope;
  probabilities: Probabilities;
  /** The source's own predicted score (integers 0–20). */
  predictedScore?: { home: number; away: number };
  confidence?: Confidence;
};

export type ScreeningSettings = {
  high: number;
  low: number;
  windowDays: 1 | 2;
  formScope: FormScope;
  timezone: string;
};

export type ScreeningResult = {
  qualifies: boolean;
  strongSide: Side | null;
  /** |home − away|, always computed (even when the match does not qualify). */
  formGap: number;
};

export type InvalidItem = { index: number; id?: string; reason: string };

export type NormalizedPayload = {
  valid: RawMatchInput[];
  invalid: InvalidItem[];
  /** Earlier items dropped because a later item had the same provider + id. */
  duplicates: number;
};
