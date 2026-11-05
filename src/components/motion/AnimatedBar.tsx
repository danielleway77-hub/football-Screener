"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useAnimateOnMount } from "@/hooks/useAnimateOnMount";
import { BAR_MAX_DELAY, DURATION, EASE_OUT, useMotionPrefs } from "@/lib/motion";
import { cn } from "@/lib/utils";

type AnimatedBarProps = {
  /** 0–100; values outside are clamped. */
  pct: number;
  /** Stagger position: delay = index × 60ms (capped at 480ms). */
  index?: number;
  className?: string;
  "data-testid"?: string;
};

/**
 * The fill of a progress/form bar: width 0 → pct over 700ms. Place it inside a track element
 * (`overflow-hidden`). The first server-rendered paint and reduced motion show the final width.
 */
export function AnimatedBar({ pct, index = 0, className, ...rest }: AnimatedBarProps) {
  const { reduce } = useMotionPrefs();
  const animateOnMount = useAnimateOnMount();
  const target = Math.min(100, Math.max(0, pct));
  const delay = Math.min(BAR_MAX_DELAY, index * 0.06);

  if (reduce) {
    return (
      <div
        className={cn("h-full", className)}
        style={{ width: `${target}%` }}
        data-motion="static"
        {...rest}
      />
    );
  }

  return (
    <motion.div
      className={cn("h-full", className)}
      data-motion="bar"
      initial={animateOnMount ? { width: "0%" } : false}
      animate={{ width: `${target}%` }}
      transition={{ duration: DURATION.bar, ease: EASE_OUT, delay }}
      {...rest}
    />
  );
}
