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
    lastUpdate,
    scanned: usable?.scanned ?? 0,
    qualified: usable?.qualified ?? 0,
    stale: !lastUpdate || now.getTime() - lastUpdate.getTime() > staleMs,
  };
}
