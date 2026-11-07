"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type RadioCardOption<T extends string> = {
  value: T;
  title: string;
  description: string;
  /** Small status tag (e.g. "Not configured"). */
  tag?: string;
};

type RadioCardsProps<T extends string> = {
  /** Accessible group name (rendered as a visually hidden legend). */
  legend: string;
  name: string;
  options: RadioCardOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Two columns from the sm breakpoint (compact choices); default is a full-width stack. */
  columns?: 1 | 2;
  className?: string;
};

/**
 * Radio group rendered as selectable cards. Native radios (arrow keys, form semantics), the whole card
 * is the label; selected = primary-soft + primary border; focus ring follows the hidden input.
 */
export function RadioCards<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  disabled,
  columns = 1,
  className,
}: RadioCardsProps<T>) {
  return (
    <fieldset
      disabled={disabled}
      className={cn("grid gap-3", columns === 2 && "sm:grid-cols-2", className)}
    >
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            data-selected={selected}
            className={cn(
              "relative flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              selected
                ? "border-primary-border bg-primary-soft"
                : "border-border-control bg-subtle hover:border-hairline-strong",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                selected ? "border-primary ring-1 ring-primary" : "border-border-control",
              )}
            >
              {selected ? <span className="size-2.5 rounded-full bg-primary" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-body font-semibold">{option.title}</span>
                {option.tag ? (
                  <span className="rounded-4xl border border-hairline-strong bg-neutral-soft px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {option.tag}
                  </span>
                ) : null}
              </span>
              <span className="text-body-sm mt-1 block text-muted-foreground">
                {option.description}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
