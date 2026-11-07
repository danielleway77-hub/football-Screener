"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useAnimateOnMount } from "@/hooks/useAnimateOnMount";
import { EASE_OUT, useMotionPrefs } from "@/lib/motion";

/** Predicted score entrance: a gentle scale-up once, after hydration only. SSR and reduced motion show the final state. */
export function ScorePop({ children }: { children: React.ReactNode }) {
  const { reduce } = useMotionPrefs();
  const animate = useAnimateOnMount();
  if (reduce) return <>{children}</>;
  return (
    <motion.span
      className="inline-block"
      initial={animate ? { opacity: 0, scale: 0.88 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.25 }}
    >
      {children}
    </motion.span>
  );
}
