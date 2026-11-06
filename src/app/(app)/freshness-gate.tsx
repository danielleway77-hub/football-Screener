import { RunAction } from "@/components/dashboard/RunAction";
import { FreshnessPill } from "@/components/layout/FreshnessPill";
import { StaleBanner } from "@/components/states/StaleBanner";
import { formatRunTime } from "@/lib/format";
import { getProvider } from "@/server/providers";
import { getFreshness } from "./freshness-data";

/** Stale-data banner for every page: only when data exists and is older than `staleAfterHrs`. */
export async function FreshnessGate() {
  const { settings, stats, now } = await getFreshness();
  if (!stats.lastUpdate || !stats.stale) return null;
  const hours = Math.floor((now.getTime() - stats.lastUpdate.getTime()) / 3_600_000);
  return (
    <StaleBanner
      hours={hours}
      action={<RunAction canPull={getProvider(settings.accessMode).canPull} />}
    />
  );
}

/** Navbar pill, rendered on the server with the initial value (no client flash). */
export async function NavFreshness() {
  const { settings, stats, now } = await getFreshness();
  return (
    <FreshnessPill
      updatedIso={stats.lastUpdate?.toISOString() ?? null}
      running={stats.lastRun?.status === "RUNNING"}
      staleAfterHrs={settings.staleAfterHrs}
      nowIso={now.toISOString()}
      exactLabel={stats.lastUpdate ? formatRunTime(stats.lastUpdate, now, settings.timezone) : null}
    />
  );
}
