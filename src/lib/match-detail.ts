import { formatPct } from "@/lib/format";
import { sanitizeNext } from "@/lib/next-param";

/** Pure rules for the match detail page (no React, no I/O) so they are unit-testable. */

/** Match ids are cuids; anything else cannot exist, so the page can 404 without a database round trip. */
export function isPlausibleMatchId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

/**
 * Where "Back to dashboard" goes. `from` carries the dashboard's query string ("?tab=today&league=Liga%201"
 * or "/?tab=today"); only the dashboard path "/" with an optional query is accepted. Anything else
 * (other paths, protocol-relative URLs, schemes, backslashes, control characters) falls back to "/".
 */
export function safeBackHref(from: string | string[] | null | undefined): string {
  const raw = Array.isArray(from) ? from[0] : from;
  if (typeof raw !== "string" || raw.length === 0) return "/";
  const candidate = raw.startsWith("?") ? `/${raw}` : raw;
  const safe = sanitizeNext(candidate);
  if (safe === "/") return "/";
  return safe.startsWith("/?") ? safe : "/";
}

/** Link to another match that keeps the dashboard context (`from`) so Back still returns to the same filters. */
export function matchHref(id: string, backHref: string): string {
  const base = `/matches/${encodeURIComponent(id)}`;
  if (backHref === "/") return base;
  return `${base}?from=${encodeURIComponent(backHref)}`;
}

export type FormSides = {
  homeName: string;
  awayName: string;
  homePct: number;
  awayPct: number;
  low: number;
  high: number;
};

export type SideInfo = "HOME" | "AWAY" | null;

/** Strong side under the CURRENT thresholds (the stored flag may be stale until a re-screen runs). */
export function strongSideOf({ homePct, awayPct, low, high }: FormSides): SideInfo {
  if (homePct > high && awayPct < low) return "HOME";
  if (awayPct > high && homePct < low) return "AWAY";
  return null;
}

/** Form gap in points, two decimals at most. */
export function formGapPts(homePct: number, awayPct: number): number {
  return Math.round(Math.abs(homePct - awayPct) * 100) / 100;
}

/**
 * The sentence that explains the verdict in words (nothing is conveyed by colour alone).
 * Always names both teams and both percentages.
 */
export function explainQualification(sides: FormSides): string {
  const { homeName, awayName, homePct, awayPct, low, high } = sides;
  const side = strongSideOf(sides);
  if (side) {
    const strong = side === "HOME" ? { n: homeName, p: homePct } : { n: awayName, p: awayPct };
    const weak = side === "HOME" ? { n: awayName, p: awayPct } : { n: homeName, p: homePct };
    return `${strong.n}'s form (${formatPct(strong.p)}) is above ${high}% and ${weak.n}'s (${formatPct(weak.p)}) is below ${low}%.`;
  }
  return `Neither team pair meets the rule: ${homeName}'s form is ${formatPct(homePct)} and ${awayName}'s is ${formatPct(awayPct)}, and one team must be above ${high}% while the other is below ${low}%.`;
}

export const SCOPE_LABEL = { league: "League form", overall: "Overall form" } as const;

/** Only http(s) URLs may become links (a stored `javascript:` or `data:` URL must never be rendered as href). */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
