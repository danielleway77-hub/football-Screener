import { formatDistanceStrict, isSameDay } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

/** Display formatting helpers (UI_BLUEPRINT §15). Time is always passed in — never read here. */

/** `80` → "80%", `62.5` → "62.5%", `80.04` → "80%". Missing → "—". One decimal at most. */
export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

/** "Wed 4 Nov · 19:45" in the given IANA timezone (24h). */
export function formatKickoff(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, "EEE d MMM · HH:mm");
}

/** "Today 06:58", "Yesterday 06:58", "Tomorrow 06:58", else "Mon 3 Nov 06:58" (owner timezone). */
export function formatRunTime(date: Date, now: Date, timeZone: string): string {
  const day = toZonedTime(date, timeZone);
  const today = toZonedTime(now, timeZone);
  const time = formatInTimeZone(date, timeZone, "HH:mm");
  if (isSameDay(day, today)) return `Today ${time}`;
  const dayMs = 24 * 60 * 60 * 1000;
  if (isSameDay(day, new Date(today.getTime() - dayMs))) return `Yesterday ${time}`;
  if (isSameDay(day, new Date(today.getTime() + dayMs))) return `Tomorrow ${time}`;
  return formatInTimeZone(date, timeZone, "EEE d MMM HH:mm");
}

/** "2 hours ago", "in 1 day", "just now" (< 45 s). */
export function formatRelative(date: Date, now: Date): string {
  const diff = date.getTime() - now.getTime();
  if (Math.abs(diff) < 45_000) return "just now";
  const text = formatDistanceStrict(date, now, { roundingMethod: "floor" });
  return diff < 0 ? `${text} ago` : `in ${text}`;
}

/** 4_000 → "4s", 72_000 → "1m 12s", 3_900_000 → "1h 5m". Negative/NaN → "—". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

/** Time until `ms` from now as "in 5 h 12 m", "in 2 d 3 h", "in 12 m", "now" (< 1 min). */
export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms < 60_000) return "now";
  const totalMin = Math.floor(ms / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return h > 0 ? `in ${d} d ${h} h` : `in ${d} d`;
  if (h > 0) return `in ${h} h ${m} m`;
  return `in ${m} m`;
}

/** Compact age for the navbar pill: "just now", "12 m ago", "2 h ago", "3 d ago". */
export function formatAgo(ms: number): string {
  if (!Number.isFinite(ms) || ms < 60_000) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
