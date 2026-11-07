"use client";

import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNowTick } from "@/hooks/useNowTick";
import { formatAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export type FreshnessPillProps = {
  /** When the data was last updated (SUCCESS/PARTIAL run), or null when there is none. */
  updatedIso: string | null;
  /** A run is in progress. */
  running: boolean;
  staleAfterHrs: number;
  /** Server clock at render time, so the first client render equals the server HTML. */
  nowIso: string;
  /** "Today 06:58" in the owner timezone, computed on the server. */
  exactLabel: string | null;
  className?: string;
};

export type PillTone = "positive" | "warning" | "faint" | "running";

/** Dot colour: positive within half of the stale window, warning after that, faint when never. */
export function pillTone(
  updatedMs: number | null,
  nowMs: number,
  staleAfterHrs: number,
  running: boolean,
): PillTone {
  if (running) return "running";
  if (updatedMs === null) return "faint";
  return nowMs - updatedMs <= (staleAfterHrs * 3_600_000) / 2 ? "positive" : "warning";
}

const DOT: Record<PillTone, string> = {
  positive: "bg-positive",
  warning: "bg-warning",
  faint: "bg-faint",
  running: "bg-primary animate-pulse motion-reduce:animate-none",
};

/**
 * Navbar freshness pill (UI_BLUEPRINT §34): 32px, status dot + "Updated 2 h ago", click opens /runs.
 * The exact time is in the aria-label (and the tooltip), so it is never tooltip-only. Fixed minimum
 * width so updating the text never shifts the navbar. Relative text refreshes every 60 s (paused in
 * hidden tabs).
 */
export function FreshnessPill({
  updatedIso,
  running,
  staleAfterHrs,
  nowIso,
  exactLabel,
  className,
}: FreshnessPillProps) {
  const now = useNowTick(nowIso);
  const updatedMs = updatedIso ? new Date(updatedIso).getTime() : null;
  const tone = pillTone(updatedMs, now, staleAfterHrs, running);
  const ago = updatedMs === null ? null : formatAgo(now - updatedMs);
  const text = running ? "Checking…" : ago === null ? "No data yet" : `Updated ${ago}`;
  const label =
    exactLabel && !running
      ? `Data last updated ${exactLabel}. View run history.`
      : running
        ? "A check is running. View run history."
        : "No data yet. View run history.";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/runs"
          aria-label={label}
          data-testid="freshness-pill"
          data-tone={tone}
          className={cn(
            "inline-flex h-8 min-w-[150px] items-center justify-center gap-2 rounded-4xl border border-hairline-strong px-3 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground",
            className,
          )}
        >
          <span aria-hidden="true" className="relative inline-flex size-2 shrink-0">
            {tone === "positive" ? <span className="live-ring" /> : null}
            <span className={cn("relative size-2 rounded-full", DOT[tone])} />
          </span>
          <span aria-hidden="true">
            {text.split(/(\d+)/).map((part, i) =>
              i % 2 ? (
                <span key={i} className="num">
                  {part}
                </span>
              ) : (
                part
              ),
            )}
          </span>
        </Link>
      </TooltipTrigger>
      <TooltipContent>{exactLabel && !running ? exactLabel : "No data yet"}</TooltipContent>
    </Tooltip>
  );
}
