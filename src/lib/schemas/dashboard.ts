import { z } from "zod";

export const DAY_VALUES = ["upcoming", "today", "tomorrow", "dayafter"] as const;
export const SORT_VALUES = ["kickoff", "gap"] as const;
export type DashboardDay = (typeof DAY_VALUES)[number];
export type DashboardSort = (typeof SORT_VALUES)[number];

export type DashboardParams = { day: DashboardDay; q: string; sort: DashboardSort };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const schema = z.object({
  day: z.enum(DAY_VALUES).catch("upcoming"),
  // Trimmed, capped at 60 characters; anything longer is cut (never an error).
  q: z
    .string()
    .transform((v) => v.trim().slice(0, 60))
    .catch(""),
  sort: z.enum(SORT_VALUES).catch("kickoff"),
});

/**
 * Validated dashboard search params; invalid values fall back to the defaults. "dayafter" only exists
 * when the window is 2 days, so it falls back to "upcoming" for a 1-day window.
 */
export function parseDashboardParams(
  raw: Record<string, string | string[] | undefined>,
  windowDays: number,
): DashboardParams {
  const parsed = schema.parse({
    day: first(raw.day),
    q: first(raw.q) ?? "",
    sort: first(raw.sort),
  });
  return {
    ...parsed,
    day: parsed.day === "dayafter" && windowDays < 2 ? "upcoming" : parsed.day,
  };
}

/** Query string for the given params; defaults are omitted so the default URL stays "/". */
export function dashboardHref(params: Partial<DashboardParams>): string {
  const qs = new URLSearchParams();
  if (params.day && params.day !== "upcoming") qs.set("day", params.day);
  if (params.q) qs.set("q", params.q);
  if (params.sort && params.sort !== "kickoff") qs.set("sort", params.sort);
  const text = qs.toString();
  return text ? `/?${text}` : "/";
}
