"use client";

import { CountUp } from "@/components/motion/CountUp";

const formatPts = (v: number) => `${Math.round(v * 10) / 10} pts`;

/** CountUp with the "pts" formatter (functions cannot cross the server/client boundary, so it lives here). */
export function PtsCount({ value, className }: { value: number; className?: string }) {
  return <CountUp value={value} format={formatPts} className={className} />;
}
