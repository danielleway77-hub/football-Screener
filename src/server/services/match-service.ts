import { dayRangeFor, type Tab } from "@/server/domain/window";
import * as matches from "@/server/repositories/matches";
import * as runs from "@/server/repositories/runs";
import type { MatchRecord, RunRecord, SettingRecord } from "@/server/repositories/types";

export type DashboardQuery = {
  tab: Tab;
  league?: string;
  sort?: "kickoff" | "gap";
  limit?: number;
};

export type RunStats = {
  lastRun: RunRecord | null;
  /** When the last SUCCESS/PARTIAL run finished (the data's freshness). */
  lastUpdate: Date | null;
  /** The latest SUCCESS/PARTIAL run (the data on screen comes from it). */
  usable: RunRecord | null;
  scanned: number;
  qualified: number;
  stale: boolean;
};

/** Qualifying matches for a dashboard tab; only matches that have not kicked off yet. */
export async function getDashboard(
  query: DashboardQuery,
  settings: SettingRecord,
  now: Date,
): Promise<MatchRecord[]> {
  const range = dayRangeFor(query.tab, now, settings.timezone);
  return matches.findQualifyingUpcoming({
    from: range.fromUtc > now ? range.fromUtc : now,
    to: range.toUtc,
    league: query.league?.trim() || undefined,
    sort: query.sort,
    limit: Math.min(query.limit ?? 200, 200),
  });
}

export type DashboardSummary = {
  /** Qualifying matches that have not kicked off yet (all days, no filters). */
  total: number;
  perDay: Record<"today" | "tomorrow" | "dayafter", number>;
  /** Kickoff of the soonest qualifying match, or null. */
  nextKickoff: Date | null;
};

/** Counts behind the tab pills and the bento hero (4 COUNT queries + 1 row, no N+1). */
export async function getDashboardSummary(
  settings: SettingRecord,
  now: Date,
): Promise<DashboardSummary> {
  const range = (tab: Tab) => dayRangeFor(tab, now, settings.timezone);
  const [total, today, tomorrow, dayafter, next] = await Promise.all([
    matches.countQualifying(now, range("upcoming").toUtc),
    matches.countQualifying(now, range("today").toUtc),
    matches.countQualifying(range("tomorrow").fromUtc, range("tomorrow").toUtc),
    matches.countQualifying(range("dayafter").fromUtc, range("dayafter").toUtc),
    matches.findQualifyingUpcoming({ from: now, to: range("upcoming").toUtc, limit: 1 }),
  ]);
  return {
    total,
    perDay: { today, tomorrow, dayafter },
    nextKickoff: next[0]?.kickoffAt ?? null,
  };
}

/** One match with its previous/next qualifying neighbours; with `now`, neighbours are limited to upcoming matches. */
export async function getMatch(
  id: string,
  now?: Date,
): Promise<{ match: MatchRecord; previous: MatchRecord | null; next: MatchRecord | null } | null> {
  const match = await matches.findById(id);
  if (!match) return null;
  const { previous, next } = await matches.findNeighbors(id, now);
  return { match, previous, next };
}

export async function getRunStats(settings: SettingRecord, now: Date): Promise<RunStats> {
  const [latest, usable] = await Promise.all([runs.list({ pageSize: 1 }), runs.getLatestUsable()]);
  const lastUpdate = usable?.finishedAt ?? null;
  const staleMs = settings.staleAfterHrs * 3_600_000;
  return {
    lastRun: latest.items[0] ?? null,
    usable,
    lastUpdate,
    scanned: usable?.scanned ?? 0,
    qualified: usable?.qualified ?? 0,
    stale: !lastUpdate || now.getTime() - lastUpdate.getTime() > staleMs,
  };
}
