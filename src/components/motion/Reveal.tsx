"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";
import { useAnimateOnMount } from "@/hooks/useAnimateOnMount";
import { HIDDEN, revealTransition, useMotionPrefs, VISIBLE } from "@/lib/motion";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Seconds. */
  delay?: number;
};

/**
 * Fades + rises 8px the FIRST time the element scrolls into view (once). Content that is part of
 * the initial server render is shown immediately (never hidden waiting for JavaScript); only
 * content that mounts after hydration animates. Reduced motion → plain, final state.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const { reduce } = useMotionPrefs();
  const animateOnMount = useAnimateOnMount();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={className}
      data-motion="reveal"
      data-revealed={inView || undefined}
      initial={animateOnMount ? HIDDEN : false}
      animate={animateOnMount && !inView ? HIDDEN : VISIBLE}
      transition={{ ...revealTransition, delay }}
    >
      {children}
    </motion.div>
  );
}
