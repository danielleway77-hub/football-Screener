"use client";

import * as React from "react";
import { fetchJson } from "@/lib/fetcher";

export type PolledRun = {
  id: string;
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
  scanned: number;
  qualified: number;
  failedCount: number;
  error: string | null;
};

type Options = {
  intervalMs?: number;
  /** Delay before the first poll (default: one interval). */
  firstDelayMs?: number;
  timeoutMs?: number;
  onTerminal: (run: PolledRun) => void;
  onTimeout: () => void;
};

export const RUN_POLL_INTERVAL_MS = 2000;
export const RUN_POLL_TIMEOUT_MS = 3 * 60_000;

/**
 * Polls GET /api/runs/[id] while `runId` is set. Stops on a terminal status, after the timeout, and on
 * unmount / runId change (in-flight request aborted). Network errors are retried on the next tick.
 */
export function useRunPolling(runId: string | null, options: Options): void {
  const latest = React.useRef(options);
  React.useEffect(() => {
    latest.current = options;
  });

  React.useEffect(() => {
    if (!runId) return;
    const controller = new AbortController();
    const interval = latest.current.intervalMs ?? RUN_POLL_INTERVAL_MS;
    const timeout = latest.current.timeoutMs ?? RUN_POLL_TIMEOUT_MS;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      try {
        const run = await fetchJson<PolledRun>(`/api/runs/${runId}`, {
          signal: controller.signal,
          retries: 0,
        });
        if (stopped) return;
        if (run.status !== "RUNNING") {
          stopped = true;
          latest.current.onTerminal(run);
          return;
        }
      } catch {
        if (stopped) return;
        // Transient failure: keep polling until the timeout.
      }
      if (Date.now() - startedAt >= timeout) {
        stopped = true;
        latest.current.onTimeout();
        return;
      }
      timer = setTimeout(tick, interval);
    };
    timer = setTimeout(tick, latest.current.firstDelayMs ?? interval);

    return () => {
      stopped = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [runId]);
}
