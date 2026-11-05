"use client";

import * as React from "react";
import { animate, useInView } from "framer-motion";
import { useAnimateOnMount } from "@/hooks/useAnimateOnMount";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, useMotionPrefs } from "@/lib/motion";

type CountUpProps = {
  value: number;
  /** Turns the running number into text (default: rounded integer). */
  format?: (value: number) => string;
  className?: string;
};

const defaultFormat = (v: number) => String(Math.round(v));

/**
 * Counts from 0 to `value` in 800ms the first time it is on screen, once per mount.
 * Digits are tabular (no jitter). The FINAL value is always in the accessible text, the running
 * number is aria-hidden. Reduced motion, server render and value changes show the final value.
 */
export function CountUp({ value, format = defaultFormat, className }: CountUpProps) {
  const { reduce } = useMotionPrefs();
  const animateOnMount = useAnimateOnMount(); // false for the first server-rendered paint
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = React.useState(animateOnMount && !reduce ? 0 : value);
  const [lastValue, setLastValue] = React.useState(value);

  // A new value (after mount) is shown immediately; counting is a first-view effect only.
  if (lastValue !== value) {
    setLastValue(value);
    setDisplay(value);
  }

  React.useEffect(() => {
    if (reduce || !animateOnMount || !inView) return;
    const controls = animate(0, value, {
      duration: DURATION.countUp,
      ease: EASE_OUT,
      onUpdate: setDisplay,
    });
    return () => controls.stop();
    // Run only when the element first becomes visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce]);

  const shown = reduce ? value : display;
  return (
    <span ref={ref} className={cn("num", className)} data-motion="countup">
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden="true" data-testid="countup-visible">
        {format(shown)}
      </span>
    </span>
  );
}
