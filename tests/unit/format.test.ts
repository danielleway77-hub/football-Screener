import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatKickoff,
  formatPct,
  formatRelative,
  formatRunTime,
} from "@/lib/format";

const NOW = new Date("2026-11-03T12:00:00Z");

describe("formatPct", () => {
  it("drops trailing .0 and keeps at most one decimal", () => {
    expect(formatPct(80)).toBe("80%");
    expect(formatPct(80.04)).toBe("80%");
    expect(formatPct(62.5)).toBe("62.5%");
    expect(formatPct(0)).toBe("0%");
    expect(formatPct(100)).toBe("100%");
  });
  it("shows a dash for missing values, never 0", () => {
    expect(formatPct(null)).toBe("—");
    expect(formatPct(undefined)).toBe("—");
    expect(formatPct(Number.NaN)).toBe("—");
  });
});

describe("formatKickoff", () => {
  it("renders in the owner timezone, 24h", () => {
    expect(formatKickoff(new Date("2026-11-04T19:45:00Z"), "Europe/London")).toBe(
      "Wed 4 Nov · 19:45",
    );
  });
  it("applies British Summer Time (UTC+1) in summer", () => {
    expect(formatKickoff(new Date("2026-07-15T18:45:00Z"), "Europe/London")).toBe(
      "Wed 15 Jul · 19:45",
    );
  });
  it("is correct on the autumn DST change day (2026-10-25)", () => {
    expect(formatKickoff(new Date("2026-10-25T00:30:00Z"), "Europe/London")).toBe(
      "Sun 25 Oct · 01:30",
    );
    expect(formatKickoff(new Date("2026-10-25T01:30:00Z"), "Europe/London")).toBe(
      "Sun 25 Oct · 01:30",
    );
    expect(formatKickoff(new Date("2026-10-25T10:00:00Z"), "Europe/London")).toBe(
      "Sun 25 Oct · 10:00",
    );
  });
  it("uses the given timezone, not the machine's", () => {
    expect(formatKickoff(new Date("2026-11-04T19:45:00Z"), "Asia/Karachi")).toBe(
      "Thu 5 Nov · 00:45",
    );
  });
});

describe("formatRunTime", () => {
  const tz = "Europe/London";
  it("says Today / Yesterday / Tomorrow in the owner's day", () => {
    expect(formatRunTime(new Date("2026-11-03T06:58:00Z"), NOW, tz)).toBe("Today 06:58");
    expect(formatRunTime(new Date("2026-11-02T06:58:00Z"), NOW, tz)).toBe("Yesterday 06:58");
    expect(formatRunTime(new Date("2026-11-04T06:58:00Z"), NOW, tz)).toBe("Tomorrow 06:58");
    expect(formatRunTime(new Date("2026-10-30T06:58:00Z"), NOW, tz)).toBe("Fri 30 Oct 06:58");
  });
});

describe("formatRelative", () => {
  it("formats past and future distances", () => {
    expect(formatRelative(new Date("2026-11-03T10:00:00Z"), NOW)).toBe("2 hours ago");
    expect(formatRelative(new Date("2026-11-04T12:00:00Z"), NOW)).toBe("in 1 day");
    expect(formatRelative(new Date("2026-11-03T11:59:30Z"), NOW)).toBe("just now");
  });
});

describe("formatDuration", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatDuration(4_000)).toBe("4s");
    expect(formatDuration(72_000)).toBe("1m 12s");
    expect(formatDuration(120_000)).toBe("2m");
    expect(formatDuration(3_900_000)).toBe("1h 5m");
  });
  it("handles invalid input", () => {
    expect(formatDuration(-1)).toBe("—");
    expect(formatDuration(Number.NaN)).toBe("—");
  });
});
