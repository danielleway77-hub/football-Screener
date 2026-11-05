"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";
import { useAnimateOnMount } from "@/hooks/useAnimateOnMount";
import { STAGGER_MAX_ITEMS, staggerContainer, staggerItem, useMotionPrefs } from "@/lib/motion";

type StaggerProps = { children: React.ReactNode; className?: string };

/** Container that reveals its `StaggerItem`s one after another (60 ms apart) on first view. */
export function Stagger({ children, className }: StaggerProps) {
  const { reduce } = useMotionPrefs();
  const animateOnMount = useAnimateOnMount();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={staggerContainer}
      initial={animateOnMount ? "hidden" : false}
      animate={animateOnMount && !inView ? "hidden" : "visible"}
    >
      {children}
    </motion.div>
  );
}

type StaggerItemProps = {
  children: React.ReactNode;
  className?: string;
  /** Position in the list: only the first 8 items animate, the rest render instantly. */
  index: number;
};

export function StaggerItem({ children, className, index }: StaggerItemProps) {
  const { reduce } = useMotionPrefs();
  if (reduce || index >= STAGGER_MAX_ITEMS) {
    return (
      <div className={className} data-motion="static">
        {children}
      </div>
    );
  }
  return (
    <motion.div className={className} variants={staggerItem} data-motion="animated">
      {children}
    </motion.div>
  );
}
