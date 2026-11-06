import type { RunStats } from "@/server/services/match-service";

export type RunPanelState = "never" | "running" | "success" | "partial" | "failed" | "stale";

/** Which state the run status panel shows (UI_BLUEPRINT §4.3). SKIPPED runs are bookkeeping and ignored. */
export function derivePanelState(stats: RunStats): RunPanelState {
  const latest = stats.lastRun;
  if (latest?.status === "RUNNING") return "running";
  if (latest?.status === "FAILED") return "failed";
  if (!stats.usable) return "never";
  if (stats.stale) return "stale";
  return stats.usable.status === "PARTIAL" ? "partial" : "success";
}
