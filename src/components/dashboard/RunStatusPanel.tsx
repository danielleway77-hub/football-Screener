"use client";

import Link from "next/link";
import { ErrorState } from "@/components/states/ErrorState";
import { StatusChip, type ChipStatus } from "@/components/shared/StatusChip";
import { Button } from "@/components/ui/button";
import { RunButton } from "./RunButton";
import { useRunNow } from "./useRunNow";

export type RunPanelState = "never" | "running" | "success" | "partial" | "failed" | "stale";

export type RunPanelProps = {
  state: RunPanelState;
  canPull: boolean;
  /** A RUNNING run found on page load (polling resumes). */
  runningRunId: string | null;
  /** "Updated Today 06:58 · 2 h ago", computed on the server in the owner's timezone. */
  updatedText: string | null;
  scanned: number;
  qualified: number;
  failedCount: number;
  /** Latest FAILED run: a human sentence. */
  failedMessage: string | null;
};

const CHIP: Record<RunPanelState, ChipStatus> = {
  never: "NO_DATA",
  running: "RUNNING",
  success: "SUCCESS",
  partial: "PARTIAL",
  failed: "FAILED",
  stale: "STALE",
};

/** Dashboard run status card: chip, freshness, counts, and the primary action (UI_BLUEPRINT §4.3). */
export function RunStatusPanel(props: RunPanelProps) {
  const run = useRunNow(props.runningRunId);
  const state: RunPanelState = run.running ? "running" : props.state;
  const { scanned, qualified, failedCount } = props;

  return (
    <section
      aria-label="Run status"
      data-testid="run-status-panel"
      data-state={state}
      className="surface-1 relative overflow-hidden rounded-lg p-4 md:p-5"
    >
      {state === "running" ? (
        <span
          aria-hidden="true"
          data-testid="run-progress"
          className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-primary-soft"
        >
          <span className="block h-full w-1/3 animate-[run-indeterminate_1.2s_ease-in-out_infinite] bg-primary motion-reduce:animate-none" />
        </span>
      ) : null}

      {run.timedOut ? (
        <ErrorState
          title="This is taking too long"
          message="The check hasn't finished after 3 minutes. See the run history for details."
          secondaryAction={
            <Button asChild variant="secondary">
              <Link href="/runs">View runs</Link>
            </Button>
          }
          className="px-0 py-2"
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1">
            <StatusChip status={CHIP[state]} />
            {state !== "failed" ? (
              <p className="text-body-sm min-w-0 text-foreground">
                {state === "running"
                  ? "Checking fixtures…"
                  : state === "never"
                    ? "Nothing received yet."
                    : props.updatedText}
              </p>
            ) : null}
          </div>

          {state === "failed" ? (
            <p className="text-body-sm text-negative">
              {props.failedMessage ?? "The check didn't finish. Try again."}
            </p>
          ) : null}

          {state === "partial" ? (
            <p className="text-body-sm text-muted-foreground">
              <span className="num text-foreground">{Math.max(scanned - failedCount, 0)}</span> of{" "}
              <span className="num text-foreground">{scanned}</span> stored —{" "}
              <span className="num text-foreground">{failedCount}</span> had problems{" "}
              <Link href="/runs" className="text-primary underline-offset-4 hover:underline">
                View details
              </Link>
            </p>
          ) : state === "success" || state === "stale" ? (
            <p className="text-body-sm text-muted-foreground">
              <span className="num text-foreground">{scanned}</span> scanned ·{" "}
              <span className="num text-foreground">{qualified}</span> qualify
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            {state === "failed" ? (
              <Button asChild variant="ghost" className="max-md:flex-1">
                <Link href="/runs">View run</Link>
              </Button>
            ) : null}
            <RunButton
              canPull={props.canPull}
              run={run}
              variant="default"
              className="max-md:w-full"
            />
          </div>
        </div>
      )}
    </section>
  );
}
