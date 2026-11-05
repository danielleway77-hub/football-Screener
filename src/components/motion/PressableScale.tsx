"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { SPRING, useMotionPrefs } from "@/lib/motion";

/** Spring tap feedback (scale .98). Wrap clickable surfaces that are not already Buttons. */
export function PressableScale({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { reduce } = useMotionPrefs();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      whileTap={{ scale: 0.98 }}
      transition={SPRING}
      data-motion="pressable"
    >
      {children}
    </motion.div>
  );
}
