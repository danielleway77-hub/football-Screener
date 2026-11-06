"use client";

import { CountUp } from "@/components/motion/CountUp";
import { formatPct } from "@/lib/format";

/** CountUp with the percent formatter. A client component so server components can use it (functions cannot cross the boundary). */
export function PctCount({ value, className }: { value: number; className?: string }) {
  return <CountUp value={value} format={formatPct} className={className} />;
}
