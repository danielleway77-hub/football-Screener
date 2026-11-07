import { CrownIcon, InfoIcon } from "lucide-react";
import { PctCount } from "./PctCount";
import { formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { derived, highest1x2 } from "./logic";
import { PairTile } from "./PairTile";

export type Probabilities = {
  homeWin: number | null;
  draw: number | null;
  awayWin: number | null;
  /** Probability of "Yes". "No" is derived. */
  btts: number | null;
  /** Probability of "Over 2.5". "Under" is derived. */
  over25: number | null;
};

function StatTile({
  label,
  value,
  highest,
}: {
  label: string;
  value: number | null;
  highest: boolean;
}) {
  const missing = value === null;
  return (
    <div
      role="group"
      aria-label={missing ? `${label}: unavailable` : `${label}: ${formatPct(value)}`}
      data-testid="prob-tile"
      data-highest={highest || undefined}
      data-missing={missing || undefined}
      className={cn(
        "relative flex h-16 min-w-0 flex-col justify-between rounded-md border p-2.5",
        missing && "border-dashed border-border-strong bg-surface-raised",
        !missing && highest && "border-primary-border bg-primary-soft",
        !missing && !highest && "border-hairline bg-surface-raised",
      )}
    >
      <p className="text-overline truncate text-muted-foreground" aria-hidden="true">
        {label}
      </p>
      {missing ? (
        <p className="flex items-center gap-1.5 text-faint">
          <span aria-hidden="true" className="num text-2xl leading-none font-semibold">
            —
          </span>
          <InfoIcon className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Unavailable</span>
        </p>
      ) : (
        <p
          aria-hidden="true"
          className={cn(
            "num text-2xl leading-none font-semibold",
            highest ? "text-primary" : "text-foreground",
          )}
        >
          <PctCount value={value} />
        </p>
      )}
      {highest ? (
        <>
          <CrownIcon
            aria-hidden="true"
            className="absolute top-2 right-2 size-3 text-primary"
            data-testid="highest-mark"
          />
          <span className="sr-only">Highest</span>
        </>
      ) : null}
    </div>
  );
}

/**
 * Compact probability block used inside MatchCard at every width: three 1X2 tiles, then two pair
 * tiles. Highest of the trio only when all three exist and nothing ties; the larger of each pair is
 * lime (tie: neither). Missing values read "Unavailable", never 0.
 */
export function ProbabilityGrid({
  probabilities: p,
  className,
}: {
  probabilities: Probabilities;
  className?: string;
}) {
  const top = highest1x2(p.homeWin, p.draw, p.awayWin);
  const allMissing =
    p.homeWin === null &&
    p.draw === null &&
    p.awayWin === null &&
    p.btts === null &&
    p.over25 === null;
  return (
    <div
      role="group"
      aria-label="Probabilities"
      data-testid="probability-grid"
      data-all-missing={allMissing || undefined}
      className={cn("relative flex flex-col gap-2", allMissing && "[&>div]:opacity-55", className)}
    >
      {allMissing ? (
        <span
          aria-hidden="true"
          data-testid="prob-unavailable"
          className="text-caption absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-4xl border border-border-strong bg-surface-raised px-3 py-1 font-semibold whitespace-nowrap text-muted-foreground shadow-sm"
        >
          Probabilities unavailable
        </span>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Home win" value={p.homeWin} highest={top === "home"} />
        <StatTile label="Draw" value={p.draw} highest={top === "draw"} />
        <StatTile label="Away win" value={p.awayWin} highest={top === "away"} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PairTile
          label="Both teams score"
          shortLabel="BTTS"
          aLabel="Yes"
          aValue={p.btts}
          bLabel="No"
          bValue={derived(p.btts)}
        />
        <PairTile
          label="Over / Under 2.5"
          shortLabel="O/U 2.5"
          aLabel="Over"
          aValue={p.over25}
          bLabel="Under"
          bValue={derived(p.over25)}
        />
      </div>
    </div>
  );
}
