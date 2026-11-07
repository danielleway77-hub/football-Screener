"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronRightIcon, CircleXIcon, TriangleAlertIcon } from "lucide-react";
import { RunDetailDialog } from "@/components/runs/RunDetailDialog";
import { StatusChip } from "@/components/shared/StatusChip";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/fetcher";
import { formatRelative, formatRunTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { modeLabel, runDurationText, type RunRow } from "@/lib/run-view";

export const POLL_MS = 3000;

type Polled = Pick<
  RunRow,
  "status" | "scanned" | "qualified" | "failedCount" | "error" | "startedAt" | "finishedAt"
>;

const QUERY = "(max-width: 767px)";
function subscribe(cb: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}
/** null on the server / before hydration (both layouts are in the HTML and CSS picks one). */
function useIsMobile(): boolean | null {
  return React.useSyncExternalStore<boolean | null>(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => null,
  );
}

function TriggerChip({ trigger }: { trigger: RunRow["trigger"] }) {
  return (
    <span className="inline-flex h-6 items-center rounded-4xl border border-hairline-strong bg-neutral-soft px-2 text-xs font-semibold tracking-[0.06em] text-muted-foreground">
      {trigger}
    </span>
  );
}

function StatusCell({ run }: { run: RunRow }) {
  return (
    <span className="inline-flex items-center gap-2">
      {run.status === "PARTIAL" ? (
        <TriangleAlertIcon className="size-4 shrink-0 text-warning" aria-hidden="true" />
      ) : run.status === "FAILED" ? (
        <CircleXIcon className="size-4 shrink-0 text-negative" aria-hidden="true" />
      ) : null}
      <StatusChip status={run.status} />
    </span>
  );
}

const STRIP_COLOR: Record<RunRow["status"], string> = {
  SUCCESS: "bg-positive",
  PARTIAL: "bg-warning",
  FAILED: "bg-negative",
  RUNNING: "bg-primary animate-pulse motion-reduce:animate-none",
  SKIPPED: "bg-hairline-strong",
};

/** Mini sparkline of this page's outcomes (oldest left, newest right) plus a one-line summary. */
function OutcomeStrip({ rows }: { rows: RunRow[] }) {
  const done = rows.filter((r) => r.status !== "RUNNING" && r.status !== "SKIPPED");
  const ok = done.filter((r) => r.status === "SUCCESS").length;
  const live = rows.some((r) => r.status === "RUNNING");
  const ordered = [...rows].reverse();
  const summary = live
    ? "A run is in progress. This page updates by itself."
    : done.length
      ? `${ok} of ${done.length} recent runs finished cleanly.`
      : "No finished runs on this page.";
  return (
    <div
      data-testid="runs-outcomes"
      className="surface-1 flex min-h-11 items-center gap-4 rounded-lg px-4 py-2"
    >
      <div
        role="img"
        aria-label={`Outcomes, oldest to newest: ${ordered.map((r) => r.status.toLowerCase()).join(", ")}`}
        className="flex h-6 shrink-0 items-end gap-[3px] overflow-hidden"
      >
        {ordered.map((r) => (
          <span
            key={r.id}
            title={r.status}
            className={cn(
              "w-1.5 rounded-full",
              STRIP_COLOR[r.status],
              r.status === "SUCCESS" ? "h-4" : r.status === "SKIPPED" ? "h-2" : "h-6",
            )}
          />
        ))}
      </div>
      <p className="text-caption min-w-0 text-muted-foreground">{summary}</p>
    </div>
  );
}

type Props = {
  rows: RunRow[];
  timezone: string;
  /** Server clock at render time (ISO); the client advances it only while polling. */
  nowIso: string;
};

/** Runs table (>= 768px) or stacked cards (< 768px) plus the detail dialog and RUNNING-run polling. */
export function RunsList({ rows: serverRows, timezone, nowIso }: Props) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [now, setNow] = React.useState(() => new Date(nowIso));
  const [overrides, setOverrides] = React.useState<Record<string, Polled>>({});
  const [announce, setAnnounce] = React.useState("");
  const [dialog, setDialog] = React.useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });

  // New server data (after refresh / navigation) replaces the polled overrides and the clock.
  const [seen, setSeen] = React.useState(serverRows);
  if (seen !== serverRows) {
    setSeen(serverRows);
    setOverrides({});
    setNow(new Date(nowIso));
  }

  const rows = React.useMemo(
    () => serverRows.map((r) => (overrides[r.id] ? { ...r, ...overrides[r.id] } : r)),
    [serverRows, overrides],
  );
  const runningKey = rows
    .filter((r) => r.status === "RUNNING")
    .map((r) => r.id)
    .join(",");

  // Auto-refresh every 3 s ONLY while a visible run is RUNNING; the interval is cleared otherwise.
  React.useEffect(() => {
    if (!runningKey) return;
    const ids = runningKey.split(",");
    const controller = new AbortController();
    let busy = false;
    let failures = 0;
    const timer = window.setInterval(async () => {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      setNow(new Date());
      try {
        const results = await Promise.all(
          ids.map((id) =>
            fetchJson<Polled & { id: string }>(`/api/runs/${id}`, {
              signal: controller.signal,
              retries: 0,
            }).catch(() => null),
          ),
        );
        if (controller.signal.aborted) return;
        // 401/404/offline answer null: give up after 5 failed ticks in a row instead of polling forever.
        failures = results.every((r) => r === null) ? failures + 1 : 0;
        if (failures >= 5) window.clearInterval(timer);
        const finished = results.filter((r) => r && r.status !== "RUNNING");
        if (finished.length) {
          setOverrides((prev) => {
            const next = { ...prev };
            for (const r of finished) if (r) next[r.id] = r;
            return next;
          });
          setAnnounce(`Run finished: ${finished[0]!.status.toLowerCase()}.`);
          // Re-read the list so details, counts and ordering are the server's.
          React.startTransition(() => router.refresh());
        }
      } finally {
        busy = false;
      }
    }, POLL_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [runningKey, router]);

  const selected = rows.find((r) => r.id === dialog.id) ?? null;
  const returnFocus = React.useRef<HTMLElement | null>(null);
  const open = (id: string) => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setDialog({ open: true, id });
  };

  const showTable = isMobile !== true;
  const showCards = isMobile !== false;

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <OutcomeStrip rows={rows} />

      {showTable ? (
        <div
          data-testid="runs-table"
          className={cn("surface-1 overflow-hidden rounded-lg", showCards && "max-md:hidden")}
        >
          <table className="w-full table-fixed text-sm">
            <caption className="sr-only">Run history</caption>
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "14%" }} className="max-lg:hidden" />
              <col style={{ width: "14%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "6%" }} />
            </colgroup>
            <thead>
              <tr className="text-overline h-11 border-b border-hairline bg-subtle text-faint max-lg:text-[10px] max-lg:tracking-[0.02em]">
                <th scope="col" className="px-4 text-left font-semibold">
                  Started
                </th>
                <th scope="col" className="px-2 text-left font-semibold">
                  Trigger
                </th>
                <th scope="col" className="px-2 text-left font-semibold max-lg:hidden">
                  Mode
                </th>
                <th scope="col" className="px-2 text-left font-semibold">
                  Status
                </th>
                <th scope="col" className="px-2 text-right font-semibold">
                  Scanned
                </th>
                <th scope="col" className="px-2 text-right font-semibold">
                  Qualified
                </th>
                <th scope="col" className="px-2 text-right font-semibold">
                  Failed
                </th>
                <th scope="col" className="px-2 text-right font-semibold">
                  Duration
                </th>
                <th scope="col" className="w-0 px-2">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((run) => {
                const label = formatRunTime(new Date(run.startedAt), now, timezone);
                return (
                  <tr
                    key={run.id}
                    role="button"
                    tabIndex={0}
                    data-testid="run-row"
                    data-status={run.status}
                    onClick={() => open(run.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        open(run.id);
                      }
                    }}
                    className={cn(
                      "row-cv run-row run-rail h-14 cursor-pointer border-b border-hairline outline-none last:border-0 hover:bg-white/[0.04] focus-visible:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                      run.status === "RUNNING" && "run-live",
                    )}
                  >
                    <td className="px-4">
                      <div className="truncate font-medium">{label}</div>
                      <div className="text-caption truncate text-muted-foreground">
                        {formatRelative(new Date(run.startedAt), now)}
                      </div>
                    </td>
                    <td className="px-2">
                      <TriggerChip trigger={run.trigger} />
                    </td>
                    <td className="text-caption truncate px-2 text-muted-foreground max-lg:hidden">
                      {modeLabel(run.provider)}
                    </td>
                    <td className="px-2">
                      <StatusCell run={run} />
                    </td>
                    <td className="num px-2 text-right">{run.scanned}</td>
                    <td
                      className={cn(
                        "num px-2 text-right",
                        run.qualified > 0 ? "font-semibold text-primary" : "text-faint",
                      )}
                    >
                      {run.qualified}
                    </td>
                    <td
                      className={cn(
                        "num px-2 text-right",
                        run.failedCount > 0 ? "text-negative" : "text-faint",
                      )}
                    >
                      {run.failedCount}
                    </td>
                    <td className="num px-2 text-right whitespace-nowrap">
                      {runDurationText(run, now)}
                    </td>
                    <td className="px-2 text-faint">
                      <ChevronRightIcon className="run-chevron ml-auto size-4" aria-hidden="true" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {showCards ? (
        <ul data-testid="runs-cards" className={cn("space-y-3", showTable && "md:hidden")}>
          {rows.map((run) => (
            <li
              key={run.id}
              className={cn(
                "surface-1 run-rail run-card rounded-lg p-4 pl-5",
                run.status === "RUNNING" && "run-live",
              )}
              data-status={run.status}
              data-testid="run-card"
            >
              <div className="flex items-center justify-between gap-3">
                <StatusCell run={run} />
                <span className="text-caption text-right text-muted-foreground">
                  {formatRunTime(new Date(run.startedAt), now, timezone)}
                </span>
              </div>
              <p className="text-caption mt-3 text-muted-foreground">
                {run.trigger.charAt(0) + run.trigger.slice(1).toLowerCase()} ·{" "}
                {modeLabel(run.provider)}
              </p>
              <dl className="mt-3 grid grid-cols-3 gap-3">
                {(
                  [
                    ["Scanned", run.scanned, false],
                    ["Qualified", run.qualified, false],
                    ["Failed", run.failedCount, run.failedCount > 0],
                  ] as const
                ).map(([label, value, bad]) => (
                  <div key={label}>
                    <dt className="text-overline text-faint">{label}</dt>
                    <dd className={cn("num text-xl", bad && "text-negative")}>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-caption text-muted-foreground">
                  Duration <span className="num">{runDurationText(run, now)}</span>
                </p>
                <Button
                  variant="secondary"
                  data-testid="run-details-button"
                  aria-label={`View details for run started ${formatRunTime(
                    new Date(run.startedAt),
                    now,
                    timezone,
                  )}`}
                  onClick={() => open(run.id)}
                >
                  Details
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <RunDetailDialog
        run={selected}
        open={dialog.open}
        onOpenChange={(next) => setDialog((d) => ({ ...d, open: next }))}
        timezone={timezone}
        now={now}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          returnFocus.current?.focus();
        }}
      />
    </>
  );
}
