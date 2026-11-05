"use client";

import * as React from "react";
import { LayoutGroup, motion } from "framer-motion";
import { SPRING, useMotionPrefs } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Small count pill after the label (mono). */
  count?: number;
  disabled?: boolean;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group (required: there is no visible label by default). */
  "aria-label": string;
  disabled?: boolean;
  className?: string;
};

/**
 * Exclusive choice between 2–4 options. Accessible radiogroup: roving tabindex, ←/→/↑/↓ move AND
 * select, Home/End jump, disabled options are skipped. 44px tall; the selected pill slides.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  const groupId = React.useId();
  const { reduce } = useMotionPrefs();
  const refs = React.useRef(new Map<T, HTMLButtonElement>());

  const enabled = options.filter((o) => !o.disabled);
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  function move(to: SegmentedOption<T> | undefined) {
    if (!to) return;
    onChange(to.value);
    refs.current.get(to.value)?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;
    const at = enabled.findIndex((o) => o.value === value);
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        move(enabled[(at + 1) % enabled.length]);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        move(enabled[(at - 1 + enabled.length) % enabled.length]);
        break;
      case "Home":
        event.preventDefault();
        move(enabled[0]);
        break;
      case "End":
        event.preventDefault();
        move(enabled[enabled.length - 1]);
        break;
    }
  }

  return (
    <LayoutGroup id={groupId}>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        className={cn(
          "inline-flex min-h-11 max-w-full [scrollbar-width:none] items-center gap-1 overflow-x-auto rounded-md border border-hairline bg-track p-1 [&::-webkit-scrollbar]:hidden",
          disabled && "opacity-50",
          className,
        )}
      >
        {options.map((option, i) => {
          const selected = option.value === value;
          const off = disabled || option.disabled;
          return (
            <button
              key={option.value}
              ref={(el) => {
                if (el) refs.current.set(option.value, el);
                else refs.current.delete(option.value);
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={off}
              tabIndex={i === selectedIndex ? 0 : -1}
              onClick={() => onChange(option.value)}
              className={cn(
                "relative inline-flex h-9 flex-1 shrink-0 items-center justify-center gap-2 rounded-sm px-4 text-[0.9375rem] font-medium whitespace-nowrap transition-colors",
                selected ? "text-primary" : "text-muted-foreground hover:text-foreground",
                off && "cursor-not-allowed",
              )}
            >
              {selected ? (
                <motion.span
                  layoutId="segment-pill"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-sm border border-primary-border bg-primary-soft"
                  transition={reduce ? { duration: 0 } : SPRING}
                />
              ) : null}
              <span className="relative">{option.label}</span>
              {option.count !== undefined ? (
                <span className="num relative rounded-full bg-surface-raised px-1.5 text-xs text-foreground">
                  {option.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
