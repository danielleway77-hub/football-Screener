import { InfoIcon } from "lucide-react";
import { PctCount } from "./PctCount";
import { formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { pairLeader } from "./logic";

type PairTileProps = {
  /** Full label for assistive tech and wide tiles ("Both teams score"). */
  label: string;
  /** Short label for narrow cards ("BTTS"). */
  shortLabel: string;
  aLabel: string;
  aValue: number | null;
  bLabel: string;
  /** Derived value (100 - a). Shown with a "calculated" note for assistive tech. */
  bValue: number | null;
  className?: string;
};

/**
 * Two labelled values side by side (Yes/No, Over/Under). The larger one is lime, a tie has no leader.
 * `bValue` is derived (decision D12) and the tile's aria-label says so. Missing -> dashed tile with
 * an Info icon and "Unavailable" (never 0).
 */
export function PairTile({
  label,
  shortLabel,
  aLabel,
  aValue,
  bLabel,
  bValue,
  className,
}: PairTileProps) {
  const missing = aValue === null || bValue === null;
  const leader = pairLeader(aValue, bValue);
  const aria = missing
    ? `${label}: unavailable`
    : `${label}: ${aLabel} ${formatPct(aValue).replace("%", "")} percent, ${bLabel} ${formatPct(bValue).replace("%", "")} percent (calculated)`;

  return (
    <div
      role="group"
      aria-label={aria}
      title={missing ? undefined : `${bLabel} is calculated as 100 minus ${aLabel}.`}
      data-testid="pair-tile"
      data-missing={missing || undefined}
      className={cn(
        "flex h-16 min-w-0 flex-col justify-between rounded-md border bg-surface-raised p-2.5",
        missing ? "border-dashed border-border-strong" : "border-hairline",
        className,
      )}
    >
      <p className="text-overline truncate text-muted-foreground" aria-hidden="true">
        <span className="@[340px]:hidden">{shortLabel}</span>
        <span className="hidden @[340px]:inline">{label}</span>
      </p>
      {missing ? (
        <p className="flex items-center gap-1.5 text-faint">
          <span aria-hidden="true" className="num text-base font-semibold">
            —
          </span>
          <InfoIcon className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Unavailable</span>
        </p>
      ) : (
        <p aria-hidden="true" className="flex items-baseline justify-between gap-2">
          {(
            [
              [aLabel, aValue, leader === "a"],
              [bLabel, bValue, leader === "b"],
            ] as const
          ).map(([l, v, lead]) => (
            <span key={l} className="flex min-w-0 items-baseline gap-1">
              <span className="text-xs text-muted-foreground">{l}</span>
              <span
                data-lead={lead || undefined}
                className={cn(
                  "num text-base font-semibold",
                  lead ? "text-primary" : "text-foreground",
                )}
              >
                <PctCount value={v} />
              </span>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
