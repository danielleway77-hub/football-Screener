import { formatKickoff, formatRelative } from "@/lib/format";
import type { MatchRecord } from "@/server/repositories/types";
import type { MatchCardData } from "@/components/match/MatchCard";

/** MatchRecord -> plain card data, formatted in the owner's timezone (server side; `now` is injected). */
export function toCardData(m: MatchRecord, timezone: string, now: Date): MatchCardData {
  return {
    id: m.id,
    league: [m.country, m.league].filter(Boolean).join(" · ") || null,
    kickoffLabel: formatKickoff(m.kickoffAt, timezone),
    relativeLabel: formatRelative(m.kickoffAt, now),
    qualifies: m.qualifies,
    strongSide: m.strongSide,
    formScope: m.formScope,
    home: { name: m.homeName, logoUrl: m.homeLogoUrl, pct: m.homeFormPct },
    away: { name: m.awayName, logoUrl: m.awayLogoUrl, pct: m.awayFormPct },
    probabilities: {
      homeWin: m.pHomeWin,
      draw: m.pDraw,
      awayWin: m.pAwayWin,
      btts: m.pBtts,
      over25: m.pOver25,
    },
    predicted:
      m.predHomeGoals !== null && m.predAwayGoals !== null
        ? { home: m.predHomeGoals, away: m.predAwayGoals }
        : null,
    confidence: m.confidence,
  };
}
