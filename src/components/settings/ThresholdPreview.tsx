"use client";

import * as React from "react";
import { animate } from "framer-motion";
import { SparklesIcon } from "lucide-react";
import { DURATION, EASE_OUT, useMotionPrefs } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type FormPair = readonly [home: number, away: number];

/** Same rule as server/domain/screening.ts (strict inequalities, either side may be the strong one). */
export function countQualifying(pairs: readonly FormPair[], low: number, high: number): number {
  let n = 0;
  for (const [home, away] of pairs) {
    if ((home > high && away < low) || (away > high && home < low)) n++;
  }
  return n;
}

/** Number that tweens to its next value. First paint (and server render) is the final value. */
function Tween({ value }: { value: number }) {
  const { reduce } = useMotionPrefs();
  const [shown, setShown] = React.useState(value);
  const from = React.useRef(value);
  React.useEffect(() => {
    if (reduce) return;
    const controls = animate(from.current, value, {
      duration: DURATION.ui,
      ease: EASE_OUT,
      onUpdate: (v) => {
        from.current = v;
        setShown(Math.round(v));
      },
      onComplete: () => setShown(value),
    });
    return () => controls.stop();
  }, [value, reduce]);
  return (
    <span className="num" aria-hidden="true">
      {reduce ? value : shown}
    </span>
  );
}

type Props = {
  pairs: readonly FormPair[];
  low: number;
  high: number;
  savedLow: number;
  savedHigh: number;
  invalid?: boolean;
};

/** Live "what would qualify" read-out for the thresholds being edited, from the stored matches. */
export function ThresholdPreview({ pairs, low, high, savedLow, savedHigh, invalid }: Props) {
  const total = pairs.length;
  const valid = !invalid && Number.isFinite(low) && Number.isFinite(high) && low < high;
  const now = valid ? countQualifying(pairs, low, high) : 0;
  const before = countQualifying(pairs, savedLow, savedHigh);
  const delta = now - before;
  const pct = total > 0 ? (now / total) * 100 : 0;

  if (total === 0) {
    return (
      <div
        data-testid="threshold-preview"
        data-state="empty"
        className="text-body-sm flex items-start gap-3 rounded-md border border-dashed border-hairline-strong p-3 text-muted-foreground"
      >
        <SparklesIcon className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden="true" />
        <p>
          No stored matches yet. A live preview of what qualifies appears after the first update.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="threshold-preview"
      data-state={valid ? "ready" : "invalid"}
      className="rounded-md border border-hairline bg-subtle p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-body-sm text-muted-foreground">
          <span className="text-h3 mr-1 text-primary">{valid ? <Tween value={now} /> : "–"}</span>
          of <span className="num">{total}</span> stored {total === 1 ? "match" : "matches"} would
          qualify
        </p>
        {valid && delta !== 0 ? (
          <span
            data-testid="preview-delta"
            className={cn(
              "num inline-flex h-6 items-center rounded-full border px-2 text-xs font-semibold",
              delta > 0
                ? "border-positive/40 bg-positive-soft text-positive"
                : "border-hairline-strong bg-neutral-soft text-muted-foreground",
            )}
          >
            {delta > 0 ? "+" : "−"}
            {Math.abs(delta)} vs saved
          </span>
        ) : valid ? (
          <span className="text-caption text-faint">Same as saved</span>
        ) : (
          <span className="text-caption text-faint">Fix the thresholds to preview</span>
        )}
      </div>
      <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-soft">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {valid ? `${now} of ${total} stored matches would qualify` : ""}
      </span>
    </div>
  );
}
