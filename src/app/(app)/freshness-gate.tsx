import { StaleBanner } from "@/components/states/StaleBanner";
import { RunAction } from "@/components/dashboard/RunAction";
import { getProvider } from "@/server/providers";
import { getRunStats } from "@/server/services/match-service";
import { getSettings } from "@/server/services/settings-service";

/** Stale-data banner for every page: only when data exists and is older than `staleAfterHrs`. */
export async function FreshnessGate() {
  const settings = await getSettings();
  const now = new Date(); // after the DB read: request time, never prerendered
  const stats = await getRunStats(settings, now);
  if (!stats.lastUpdate || !stats.stale) return null;
  const hours = Math.floor((now.getTime() - stats.lastUpdate.getTime()) / 3_600_000);
  return (
    <StaleBanner
      hours={hours}
      action={<RunAction canPull={getProvider(settings.accessMode).canPull} />}
    />
  );
}
