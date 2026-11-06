import { readFileSync } from "node:fs";
import path from "node:path";
import type { MatchInput } from "@/server/repositories/types";

/** Fixed "fetch time" for fixtures: the project's deterministic clock. */
export const FIXTURE_NOW = new Date("2026-11-03T12:00:00Z");

type FixtureRow = Partial<Omit<MatchInput, "kickoffAt">> & {
  id: string;
  homeName: string;
  awayName: string;
  kickoffAt: string;
  homeFormPct: number;
  awayFormPct: number;
  qualifies: boolean;
  strongSide: "HOME" | "AWAY" | null;
};

export function loadFixtureMatches(): MatchInput[] {
  const file = path.join(process.cwd(), "tests", "fixtures", "matches.json");
  const rows = JSON.parse(readFileSync(file, "utf8")) as FixtureRow[];
  return rows.map((r) => {
    const { id, kickoffAt, ...rest } = r;
    return {
      provider: "fixture",
      providerMatchId: id,
      sourceUrl: null,
      league: null,
      country: null,
      homeLogoUrl: null,
      awayLogoUrl: null,
      formScope: "league",
      homeLastResults: null,
      awayLastResults: null,
      pHomeWin: null,
      pDraw: null,
      pAwayWin: null,
      pBtts: null,
      pOver25: null,
      predHomeGoals: null,
      predAwayGoals: null,
      confidence: null,
      formGap: Math.abs(r.homeFormPct - r.awayFormPct),
      lastRunId: null,
      fetchedAt: FIXTURE_NOW,
      ...rest,
      kickoffAt: new Date(kickoffAt),
    } satisfies MatchInput;
  });
}
