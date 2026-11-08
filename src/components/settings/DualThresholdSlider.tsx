"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DualThresholdSliderProps = {
  low: number;
  high: number;
  onChange: (next: { low: number; high: number }) => void;
  disabled?: boolean;
  lowError?: string;
  highError?: string;
};

type Draft = { low: string | null; high: string | null };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Linked low/high control (UI_BLUEPRINT §10): one 0–100 track with two thumbs, shaded zones
 * (poor / average / strong form) and two numeric inputs. The slider can never cross (low < high);
 * typed values are kept while editing and clamped into the valid range on blur.
 */
export function DualThresholdSlider({
  low,
  high,
  onChange,
  disabled,
  lowError,
  highError,
}: DualThresholdSliderProps) {
  const id = React.useId();
  const [draft, setDraft] = React.useState<Draft>({ low: null, high: null });

  function typed(which: "low" | "high", text: string) {
    const clean = text.replace(/[^\d]/g, "").slice(0, 3);
    setDraft((d) => ({ ...d, [which]: clean }));
    if (clean === "") return;
    const n = Number(clean);
    // Keep the form value in sync while typing; blur makes it valid if it is not yet.
    onChange(which === "low" ? { low: n, high } : { low, high: n });
  }

  function commit(which: "low" | "high") {
    const current = which === "low" ? low : high;
    const fallback = clamp(Number.isFinite(current) ? current : 0, 0, 100);
    const next =
      which === "low"
        ? clamp(fallback, 0, Math.max(0, high - 1))
        : clamp(fallback, Math.min(100, low + 1), 100);
    setDraft((d) => ({ ...d, [which]: null }));
    onChange(which === "low" ? { low: next, high } : { low, high: next });
  }

  function step(which: "low" | "high", event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const delta = event.key === "ArrowUp" ? 1 : -1;
    if (which === "low") onChange({ low: clamp(low + delta, 0, high - 1), high });
    else onChange({ low, high: clamp(high + delta, low + 1, 100) });
    setDraft((d) => ({ ...d, [which]: null }));
  }

  // Bubbles of thumbs that sit close together are pushed apart so both numbers stay readable.
  const close = high - low < 12;
  const lowShown = draft.low ?? String(low);
  const highShown = draft.high ?? String(high);

  return (
    <div className="space-y-4" data-testid="threshold-control">
      <div className="px-3.5 pt-8 pb-1">
        <div className="relative">
          <span
            data-testid="low-bubble"
            className="num pointer-events-none absolute -top-8 rounded-sm border border-hairline-strong bg-surface-raised px-2 py-0.5 text-xs font-semibold"
            style={{
              left: `${clamp(low, 0, 100)}%`,
              transform: close ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {low}
          </span>
          <span
            data-testid="high-bubble"
            className="num pointer-events-none absolute -top-8 rounded-sm border border-primary-border bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary"
            style={{
              left: `${clamp(high, 0, 100)}%`,
              transform: close ? "translateX(0)" : "translateX(-50%)",
            }}
          >
            {high}
          </span>
          <SliderPrimitive.Root
            data-slot="dual-threshold"
            min={0}
            max={100}
            step={1}
            minStepsBetweenThumbs={1}
            value={[clamp(low, 0, 100), clamp(high, 0, 100)]}
            onValueChange={([l, h]) => {
              if (l === undefined || h === undefined) return;
              setDraft({ low: null, high: null });
              // Radix sorts the pair, so a thumb dragged past the other one changes BOTH values.
              // Thumbs must never swap: stop the moving thumb one step short of its neighbour.
              if (l !== low && h !== high) {
                if (h > high) onChange({ low: Math.max(0, high - 1), high });
                else onChange({ low, high: Math.min(100, low + 1) });
                return;
              }
              onChange({ low: l, high: h });
            }}
            disabled={disabled}
            className="relative flex h-7 w-full touch-none items-center select-none data-disabled:opacity-50"
          >
            <SliderPrimitive.Track className="relative h-2.5 w-full grow overflow-hidden rounded-full">
              <span aria-hidden="true" className="absolute inset-0 flex">
                <span
                  className="bg-negative/35 transition-[width] duration-150 ease-out motion-reduce:transition-none"
                  style={{ width: `${low}%` }}
                />
                <span
                  className="bg-neutral-bar/40 transition-[width] duration-150 ease-out motion-reduce:transition-none"
                  style={{ width: `${Math.max(0, high - low)}%` }}
                />
                <span className="flex-1 bg-primary-soft" />
              </span>
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full border border-hairline-strong"
              />
            </SliderPrimitive.Track>
            {["Poor form threshold", "Strong form threshold"].map((label) => (
              <SliderPrimitive.Thumb
                key={label}
                aria-label={label}
                data-testid={label.startsWith("Poor") ? "low-thumb" : "high-thumb"}
                className={cn(
                  "relative block size-7 cursor-grab rounded-full bg-primary shadow-[0_0_0_3px_var(--canvas)] transition-[box-shadow,transform] duration-150 motion-reduce:transition-none",
                  "hover:scale-110 active:scale-125 active:cursor-grabbing motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
                  "after:absolute after:-inset-2 after:content-['']",
                  "hover:ring-3 hover:ring-ring/40 focus-visible:ring-3 focus-visible:ring-ring/60",
                )}
              />
            ))}
          </SliderPrimitive.Root>
        </div>
        <div
          aria-hidden="true"
          className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground"
        >
          <span className="text-negative">Poor form</span>
          <span>Average</span>
          <span className="text-primary">Strong form</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:flex sm:gap-6">
        {(
          [
            ["low", "Poor form below", lowShown, lowError],
            ["high", "Strong form above", highShown, highError],
          ] as const
        ).map(([which, label, shown, error]) => (
          <div key={which} className="min-w-0">
            <label htmlFor={`${id}-${which}`} className="mb-2 block text-sm font-medium">
              {label}
            </label>
            <div className="flex items-center gap-2">
              <Input
                id={`${id}-${which}`}
                name={which === "low" ? "lowThreshold" : "highThreshold"}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={shown}
                disabled={disabled}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-${which}-error` : undefined}
                min={which === "low" ? 0 : low + 1}
                max={which === "low" ? high - 1 : 100}
                onChange={(e) => typed(which, e.target.value)}
                onBlur={() => commit(which)}
                onKeyDown={(e) => step(which, e)}
                className="num w-[72px] text-center"
              />
              <span aria-hidden="true" className="text-muted-foreground">
                %
              </span>
            </div>
            {error ? (
              <p id={`${id}-${which}-error`} className="mt-2 text-sm text-negative" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <p className="text-body" data-testid="threshold-sentence">
        Qualifies when one team is above <strong className="num text-primary">{high}%</strong> and
        the other is below <strong className="num text-primary">{low}%</strong>.
      </p>
    </div>
  );
}
