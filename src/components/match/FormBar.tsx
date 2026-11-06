import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { AnimatedBar } from "@/components/motion/AnimatedBar";
import { PctCount } from "./PctCount";
import { formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formStrength, STRENGTH_LABEL, STRENGTH_WORD, type Strength } from "./logic";

const FILL: Record<Strength, string> = {
  strong: "bg-primary",
  poor: "bg-negative",
  average: "bg-neutral-bar",
};
const PILL: Record<Strength, string> = {
  strong: "bg-primary-soft text-primary",
  poor: "bg-negative-soft text-negative",
  average: "bg-neutral-soft text-muted-foreground",
};
const TEXT: Record<Strength, string> = {
  strong: "text-primary",
  poor: "text-negative",
  average: "text-muted-foreground",
};
const ICON = { strong: TrendingUpIcon, poor: TrendingDownIcon, average: MinusIcon } as const;

type FormBarProps = {
  pct: number;
  /** Settings thresholds: strong above `high`, poor below `low`. */
  low: number;
  high: number;
  teamName: string;
  /** Left side of the header row (logo + name). The value pill sits at the right. */
  leading?: React.ReactNode;
  /** Stagger position for the fill animation. */
  index?: number;
  /** `lg` = detail page: 12px track and tick labels. */
  size?: "md" | "lg";
  className?: string;
};

const clampPct = (v: number) => Math.min(100, Math.max(0, v));

/**
 * Form bar: value pill, 8px track with tick marks at the low/high thresholds, icon + label by strength.
 * The bar and caption are one `role="img"` with a full sentence; the pill is hidden from the tree
 * because that sentence already contains the number.
 */
export function FormBar({
  pct,
  low,
  high,
  teamName,
  leading,
  index = 0,
  size = "md",
  className,
}: FormBarProps) {
  const value = clampPct(pct);
  const strength = formStrength(value, low, high);
  const Icon = ICON[strength];
  const label = `${teamName} form ${formatPct(value).replace("%", "")} percent, ${STRENGTH_WORD[strength]}. Rule: strong above ${high}, poor below ${low}.`;
  const lg = size === "lg";

  return (
    <div className={cn("min-w-0", className)} data-strength={strength}>
      <div className="flex items-center gap-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">{leading}</div>
        <span
          aria-hidden="true"
          data-testid="form-pill"
          className={cn(
            "num shrink-0 rounded-4xl px-2.5 py-0.5 text-sm font-semibold",
            PILL[strength],
          )}
        >
          <PctCount value={value} />
        </span>
      </div>
      <div role="img" aria-label={label} className="mt-1.5">
        <div className={cn("relative", lg ? "h-3" : "h-2")}>
          <div
            data-testid="form-track"
            className="absolute inset-0 overflow-hidden rounded-4xl bg-track"
          >
            <AnimatedBar pct={value} index={index} className={cn("rounded-4xl", FILL[strength])} />
          </div>
          {[low, high].map((t) => (
            <span
              key={t}
              aria-hidden="true"
              data-testid="form-tick"
              data-at={t}
              className="absolute top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-border-strong"
              style={{ left: `${clampPct(t)}%` }}
            />
          ))}
        </div>
        {lg ? (
          <div aria-hidden="true" className="num relative mt-1.5 h-4 text-xs text-faint">
            {[low, high].map((t) => (
              <span
                key={t}
                className="absolute -translate-x-1/2"
                style={{ left: `${clampPct(t)}%` }}
              >
                {t}%
              </span>
            ))}
          </div>
        ) : null}
        <p
          className={cn("mt-1.5 flex h-4 items-center gap-1.5 text-xs font-medium", TEXT[strength])}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          {STRENGTH_LABEL[strength]}
        </p>
      </div>
    </div>
  );
}
