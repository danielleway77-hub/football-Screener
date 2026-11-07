"use client";

import { CheckIcon } from "lucide-react";
import { motion } from "framer-motion";
import { DURATION, EASE_OUT, useMotionPrefs } from "@/lib/motion";
import { cn } from "@/lib/utils";

const STEPS = ["Choose", "Review", "Import", "Done"] as const;

/**
 * Four-step progress for the import flow: Choose a source -> Review the preview -> Import -> Done.
 * Purely presentational (the page state decides `current`, 0..3). The track fills with a transform,
 * so nothing shifts; the first paint is the final state (`initial={false}`); reduced motion = no tween.
 */
export function ImportStepper({ current }: { current: 0 | 1 | 2 | 3 }) {
  const { reduce } = useMotionPrefs();
  return (
    <nav aria-label="Import progress" data-testid="import-stepper" data-step={current}>
      <ol className="relative grid grid-cols-4">
        <span
          aria-hidden="true"
          className="absolute inset-x-[12.5%] top-3.5 h-px bg-hairline-strong"
        />
        <motion.span
          aria-hidden="true"
          className="absolute inset-x-[12.5%] top-3.5 h-px origin-left bg-primary"
          initial={false}
          animate={{ scaleX: current / 3 }}
          transition={{ duration: reduce ? 0 : DURATION.reveal, ease: EASE_OUT }}
        />
        {STEPS.map((label, i) => {
          const done = i < current || (current === 3 && i === 3);
          const active = i === current && !done;
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className="relative flex flex-col items-center gap-1.5 text-center"
            >
              <span
                className={cn(
                  "num grid size-7 place-items-center rounded-full border text-xs font-bold transition-colors duration-300",
                  done && "border-primary-border bg-primary-soft text-primary",
                  active && "border-primary bg-background text-primary ring-4 ring-primary/10",
                  !done && !active && "border-hairline-strong bg-background text-faint",
                )}
              >
                {done ? <CheckIcon className="size-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-xs font-medium transition-colors duration-300",
                  active || done ? "text-foreground" : "text-faint",
                  !active && "max-sm:sr-only",
                )}
              >
                {label}
                {done ? <span className="sr-only"> (done)</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
