import type { MatchDetailModel } from "@/components/match/MatchDetailView";
import { formatInTimeZone } from "date-fns-tz";
import { formatKickoff, formatRelative } from "@/lib/format";
import {
  matchHref,
  safeExternalUrl,
  safeBackHref,
  SCOPE_LABEL,
  strongSideOf,
  type SideInfo,
} from "@/lib/match-detail";
import type { MatchRecord, SettingRecord } from "@/server/repositories/types";

const SOURCE_LABEL: Record<string, string> = {
  predigoal: "PrediGoal",
  manual_import: "Manual import",
  assisted_ingest: "Helper upload",
};

export const sourceLabel = (provider: string) => SOURCE_LABEL[provider] ?? provider;

const pairName = (m: MatchRecord) => `${m.homeName} vs ${m.awayName}`;

/**
 * Turns a stored match + current settings into display strings. The verdict is recomputed from the
 * CURRENT thresholds (`strongSideOf` mirrors the domain rule), so a threshold change shows the
 * "no longer qualifies" note before a re-screen has rewritten the stored flag.
 */
export function buildMatchDetailModel(input: {
  match: MatchRecord;
  previous: MatchRecord | null;
  next: MatchRecord | null;
  settings: Pick<SettingRecord, "lowThreshold" | "highThreshold" | "timezone">;
  now: Date;
  from?: string | string[] | null;
}): MatchDetailModel {
  const { match: m, settings, now } = input;
  const low = settings.lowThreshold;
  const high = settings.highThreshold;
  const side: SideInfo = strongSideOf({
    homeName: m.homeName,
    awayName: m.awayName,
    homePct: m.homeFormPct,
    awayPct: m.awayFormPct,
    low,
    high,
  });
  const backHref = safeBackHref(input.from);
  const target = (n: MatchRecord | null) =>
    n ? { href: matchHref(n.id, backHref), label: pairName(n) } : null;
  const tz = settings.timezone;

  return {
    home: {
      name: m.homeName,
      logoUrl: m.homeLogoUrl,
      pct: m.homeFormPct,
      results: m.homeLastResults,
    },
    away: {
      name: m.awayName,
      logoUrl: m.awayLogoUrl,
      pct: m.awayFormPct,
      results: m.awayLastResults,
    },
    competition: [m.country, m.league].filter(Boolean).join(" · ") || null,
    kickoff: formatKickoff(m.kickoffAt, tz),
    relative: formatRelative(m.kickoffAt, now),
    qualifies: side !== null,
    strongName: side === "HOME" ? m.homeName : side === "AWAY" ? m.awayName : null,
    scopeLabel: SCOPE_LABEL[m.formScope],
    confidence: m.confidence,
    low,
    high,
    probabilities: {
      homeWin: m.pHomeWin,
      draw: m.pDraw,
      awayWin: m.pAwayWin,
      btts: m.pBtts,
      over25: m.pOver25,
    },
    predictedHome: m.predHomeGoals,
    predictedAway: m.predAwayGoals,
    fetched: formatInTimeZone(m.fetchedAt, tz, "EEE d MMM HH:mm"),
    source: sourceLabel(m.provider),
    sourceUrl: safeExternalUrl(m.sourceUrl),
    backHref,
    previous: target(input.previous),
    next: target(input.next),
  };
}

export const matchTitle = pairName;
