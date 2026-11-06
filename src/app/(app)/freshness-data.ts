import { cache } from "react";
import { getRunStats, type RunStats } from "@/server/services/match-service";
import { getSettings } from "@/server/services/settings-service";
import type { SettingRecord } from "@/server/repositories/types";

export type Freshness = { settings: SettingRecord; stats: RunStats; now: Date };

/**
 * The layout's one read of "how fresh is the data": shared (per request) by the stale banner and the
 * navbar pill, so navigation adds no extra queries beyond this.
 */
export const getFreshness = cache(async (): Promise<Freshness> => {
  const settings = await getSettings();
  const now = new Date(); // after the DB read: request time, never prerendered
  const stats = await getRunStats(settings, now);
  return { settings, stats, now };
});
