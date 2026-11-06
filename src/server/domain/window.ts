import { fromZonedTime } from "date-fns-tz";

/** How far "Upcoming" looks ahead (a bounded horizon keeps the SQL range finite). */
export const UPCOMING_HORIZON_DAYS = 3650;

export type Tab = "today" | "tomorrow" | "dayafter" | "upcoming";
export type DateRange = { fromUtc: Date; toUtc: Date };
export type ScreeningWindow = DateRange & { localDates: string[] };

type Ymd = { y: number; m: number; d: number };

const pad = (n: number, width = 2) => String(n).padStart(width, "0");
const fmt = ({ y, m, d }: Ymd) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

/** The calendar date at `instant` in `timezone` (independent of the server's own timezone). */
function localDate(instant: Date, timezone: string): Ymd {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Pure calendar arithmetic on a date (no timezone involved). */
function addDays(date: Ymd, days: number): Ymd {
  const t = new Date(Date.UTC(date.y, date.m - 1, date.d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** The UTC instant at which the local calendar day `date` starts in `timezone` (DST-aware: 23 h / 25 h days). */
function startOfLocalDay(date: Ymd, timezone: string): Date {
  return fromZonedTime(`${fmt(date)}T00:00:00`, timezone);
}

function assertTimezone(timezone: string) {
  // Intl throws a RangeError for an unknown zone: fail loudly instead of silently using UTC.
  new Intl.DateTimeFormat("en-GB", { timeZone: timezone });
}

/**
 * The screening window: from the start of TOMORROW in the owner's timezone through the end of tomorrow
 * (windowDays = 1) or of the day after (windowDays = 2). `fromUtc` inclusive, `toUtc` exclusive.
 */
export function computeWindow(now: Date, timezone: string, windowDays: 1 | 2): ScreeningWindow {
  if (windowDays !== 1 && windowDays !== 2) throw new RangeError("windowDays must be 1 or 2");
  assertTimezone(timezone);
  const tomorrow = addDays(localDate(now, timezone), 1);
  const localDates = Array.from({ length: windowDays }, (_, i) => fmt(addDays(tomorrow, i)));
  return {
    fromUtc: startOfLocalDay(tomorrow, timezone),
    toUtc: startOfLocalDay(addDays(tomorrow, windowDays), timezone),
    localDates,
  };
}

/**
 * Time range of a dashboard tab, relative to `now` in the owner's timezone:
 * today = now → end of today · tomorrow / dayafter = that whole local day · upcoming = now onward.
 * A match fetched yesterday as "tomorrow" is therefore listed under Today when today arrives.
 */
export function dayRangeFor(tab: Tab, now: Date, timezone: string): DateRange {
  assertTimezone(timezone);
  const today = localDate(now, timezone);
  const day = (offset: number) => startOfLocalDay(addDays(today, offset), timezone);
  switch (tab) {
    case "today":
      return { fromUtc: now, toUtc: day(1) };
    case "tomorrow":
      return { fromUtc: day(1), toUtc: day(2) };
    case "dayafter":
      return { fromUtc: day(2), toUtc: day(3) };
    case "upcoming":
      return { fromUtc: now, toUtc: new Date(now.getTime() + UPCOMING_HORIZON_DAYS * 86_400_000) };
  }
}
