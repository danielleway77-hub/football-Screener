"use client";

import Link from "next/link";
import { XIcon } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { StatusChip } from "@/components/shared/StatusChip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatRunTime } from "@/lib/format";
import { modeLabel, runDurationText, type RunRow } from "@/lib/run-view";
import { cn } from "@/lib/utils";

type Props = {
  run: RunRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timezone: string;
  now: Date;
};

function windowText(run: RunRow, timezone: string): string {
  if (!run.windowFrom || !run.windowTo) return "—";
  const fmt = (iso: string) => formatInTimeZone(new Date(iso), timezone, "EEE d MMM HH:mm");
  return `${fmt(run.windowFrom)} – ${fmt(run.windowTo)}`;
}

/** Run details: dialog (>= 640px, 560px wide) or bottom sheet (< 640px, max 85dvh, scrollable). */
export function RunDetailDialog({ run, open, onOpenChange, timezone, now }: Props) {
  if (!run) return null;
  const summary: [string, React.ReactNode, boolean?][] = [
    ["Trigger", run.trigger.charAt(0) + run.trigger.slice(1).toLowerCase()],
    ["Mode", modeLabel(run.provider)],
    ["Window", windowText(run, timezone)],
    [
      "Scanned",
      <span key="s" className="num">
        {run.scanned}
      </span>,
    ],
    [
      "Qualified",
      <span key="q" className="num">
        {run.qualified}
      </span>,
    ],
    [
      "Failed",
      <span key="f" className={cn("num", run.failedCount > 0 && "text-negative")}>
        {run.failedCount}
      </span>,
    ],
    [
      "Duration",
      <span key="d" className="num">
        {runDurationText(run, now)}
      </span>,
    ],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        data-testid="run-detail"
        className="gap-5 p-5 max-sm:max-h-[85dvh] sm:max-w-[560px] sm:p-6"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <StatusChip status={run.status} />
            <DialogTitle className="text-h3">
              Run started {formatRunTime(new Date(run.startedAt), now, timezone)}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Summary, error and items needing attention for this run.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="-mt-1 -mr-2 shrink-0">
              <XIcon aria-hidden="true" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </header>

        <section aria-labelledby="run-summary">
          <h4 id="run-summary" className="text-overline mb-2 text-faint">
            Summary
          </h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {summary.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="min-w-0 text-right break-words sm:text-left">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {run.error ? (
          <section aria-labelledby="run-error">
            <h4 id="run-error" className="text-overline mb-2 text-faint">
              Error
            </h4>
            <p
              data-testid="run-error"
              className="text-body-sm rounded-md border border-negative/30 bg-negative-soft p-3 break-words whitespace-pre-wrap text-muted-foreground"
            >
              {run.error}
            </p>
          </section>
        ) : null}

        {run.details.length > 0 ? (
          <section aria-labelledby="run-items">
            <h4 id="run-items" className="text-overline mb-2 text-faint">
              Items needing attention{" "}
              <span className="num normal-case">({run.details.length})</span>
            </h4>
            <ScrollArea className="rounded-md border border-hairline [&_[data-slot=scroll-area-viewport]]:max-h-80">
              <ul data-testid="run-items">
                {run.details.map((item, i) => (
                  <li
                    key={`${item.index}-${i}`}
                    className="flex min-h-11 items-start gap-3 border-b border-hairline px-3 py-2.5 text-sm last:border-0"
                  >
                    <span className="num w-10 shrink-0 text-right text-muted-foreground">
                      {item.index}
                    </span>
                    <span className="num w-24 shrink-0 truncate text-muted-foreground sm:w-32">
                      {item.id ?? "—"}
                    </span>
                    <span className="min-w-0 break-words">{item.reason}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </section>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button asChild variant="secondary" className="max-sm:w-full">
            <Link href="/">View dashboard</Link>
          </Button>
          <DialogClose asChild>
            <Button className="max-sm:w-full">Close</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
