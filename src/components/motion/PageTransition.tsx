"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useAnimateOnMount } from "@/hooks/useAnimateOnMount";
import { DURATION, EASE_OUT, HIDDEN, useMotionPrefs, VISIBLE } from "@/lib/motion";

/**
 * Wrap page content (used in `app/(app)/template.tsx`, which remounts on every navigation):
 * opacity + 8px rise over 350ms. The very first server-rendered page is shown immediately.
 */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { reduce } = useMotionPrefs();
  const animate = useAnimateOnMount();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      data-motion="page"
      initial={animate ? HIDDEN : false}
      animate={VISIBLE}
      transition={{ duration: DURATION.page, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
