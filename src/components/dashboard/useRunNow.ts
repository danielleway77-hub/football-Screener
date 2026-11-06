"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useRunPolling, type PolledRun } from "@/hooks/useRunPolling";
import { AppClientError, fetchJson } from "@/lib/fetcher";

export type RunNowState = {
  running: boolean;
  timedOut: boolean;
  error: string | null;
  start: () => Promise<void>;
  dismiss: () => void;
};

function announce(run: PolledRun) {
  if (run.status === "FAILED") toast.error("The check didn't finish. Try again.");
  else if (run.qualified > 0) toast.success(`${run.qualified} qualifying matches found.`);
  else toast.success("No matches qualify right now.");
}

/**
 * The "Run now" flow: POST /api/run, poll the run every 2 s, stop on a terminal status / unmount /
 * 3 minutes, announce the result with a toast and refresh the server data.
 */
export function useRunNow(initialRunId: string | null = null): RunNowState {
  const router = useRouter();
  const [runId, setRunId] = React.useState<string | null>(initialRunId);
  const [starting, setStarting] = React.useState(false);
  const [timedOut, setTimedOut] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  useRunPolling(runId, {
    firstDelayMs: 400,
    onTerminal: (run) => {
      setRunId(null);
      announce(run);
      router.refresh();
    },
    onTimeout: () => {
      setRunId(null);
      setTimedOut(true);
    },
  });

  const start = React.useCallback(async () => {
    setError(null);
    setTimedOut(false);
    setStarting(true);
    try {
      const res = await fetchJson<{ runId: string }>("/api/run", { method: "POST" });
      setRunId(res.runId);
    } catch (e) {
      const message =
        e instanceof AppClientError ? e.message : "The check didn't finish. Try again.";
      setError(message);
      toast.error(message);
    } finally {
      setStarting(false);
    }
  }, []);

  return {
    running: starting || runId !== null,
    timedOut,
    error,
    start,
    dismiss: () => setTimedOut(false),
  };
}
