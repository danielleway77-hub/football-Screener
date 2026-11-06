import type { PercentScale } from "./types";

export type PercentResult = { ok: true; value: number } | { ok: false; reason: string };

const round2 = (n: number) => Math.round(n * 100) / 100;
const NUMERIC = /^\d+(\.\d+)?$/;

/**
 * Turns a percentage as providers send it into a number 0–100.
 *   "80%", "80 %", 80, "80.0"  → 80
 *   0.8 (bare, ≤ 1, not 0)     → AMBIGUOUS (0.8% or 80%?) → error, unless scale === "fraction"
 *   scale "fraction": 0.8 → 80 (value must be 0–1)
 * NaN, negative and > 100 are rejected. A trailing "%" always means the value is already a percent.
 */
export function normalizePercent(input: unknown, scale: PercentScale = "percent"): PercentResult {
  let value: number;
  let explicitPercent = false;

  if (typeof input === "number") {
    value = input;
  } else if (typeof input === "string") {
    let text = input.trim();
    if (text.endsWith("%")) {
      explicitPercent = true;
      text = text.slice(0, -1).trim();
    }
    if (!NUMERIC.test(text)) return { ok: false, reason: "is not a number" };
    value = Number(text);
  } else {
    return { ok: false, reason: "is not a number" };
  }

  if (!Number.isFinite(value)) return { ok: false, reason: "is not a number" };
  if (value < 0) return { ok: false, reason: "must not be negative" };

  if (!explicitPercent && scale === "fraction") {
    if (value > 1) return { ok: false, reason: "must be between 0 and 1 (fraction scale)" };
    return { ok: true, value: round2(value * 100) };
  }
  if (!explicitPercent && value > 0 && value <= 1) {
    return { ok: false, reason: `is ambiguous (${input}: 0.8% or 80%?); declare percentScale` };
  }
  if (value > 100) return { ok: false, reason: "must be between 0 and 100" };
  return { ok: true, value: round2(value) };
}
