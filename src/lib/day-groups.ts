import { formatInTimeZone } from "date-fns-tz";

export type DayGroup<T> = {
  /** Local calendar date in the owner's timezone, "2026-11-04". */
  key: string;
  /** "Today · Tue 3 Nov", "Tomorrow · Wed 4 Nov", else "Thu 5 Nov". */
  label: string;
  items: T[];
};

const localKey = (date: Date, timezone: string) => formatInTimeZone(date, timezone, "yyyy-MM-dd");

/** Calendar arithmetic on a "yyyy-MM-dd" key (no timezone involved, so DST days cannot skew it). */
function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Groups matches by LOCAL date in `timezone`. Groups are always chronological; inside a group the
 * incoming order is kept, so a server-side sort (kickoff or form gap) applies WITHIN each day.
 */
export function groupByLocalDate<T extends { kickoffAt: Date }>(
  items: T[],
  timezone: string,
  now: Date,
): DayGroup<T>[] {
  const today = localKey(now, timezone);
  const tomorrow = addDaysToKey(today, 1);
  const byKey = new Map<string, T[]>();
  for (const item of items) {
    const key = localKey(item.kickoffAt, timezone);
    const list = byKey.get(key);
    if (list) list.push(item);
    else byKey.set(key, [item]);
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, list]) => {
      const date = formatInTimeZone(list[0]!.kickoffAt, timezone, "EEE d MMM");
      const label =
        key === today ? `Today · ${date}` : key === tomorrow ? `Tomorrow · ${date}` : date;
      return { key, label, items: list };
    });
}
