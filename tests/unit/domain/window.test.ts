import { describe, expect, it } from "vitest";
import { computeWindow, dayRangeFor, UPCOMING_HORIZON_DAYS } from "@/server/domain/window";

const LONDON = "Europe/London";
const iso = (d: Date) => d.toISOString();
const hours = (w: { fromUtc: Date; toUtc: Date }) =>
  (w.toUtc.getTime() - w.fromUtc.getTime()) / 3_600_000;

describe("computeWindow", () => {
  it("tomorrow window in Europe/London on a normal day (GMT)", () => {
    const w = computeWindow(new Date("2026-11-03T12:00:00Z"), LONDON, 1);
    expect(iso(w.fromUtc)).toBe("2026-11-04T00:00:00.000Z");
    expect(iso(w.toUtc)).toBe("2026-11-05T00:00:00.000Z");
    expect(w.localDates).toEqual(["2026-11-04"]);
  });

  it("windowDays 2 extends to the day after", () => {
    const w = computeWindow(new Date("2026-11-03T12:00:00Z"), LONDON, 2);
    expect(iso(w.toUtc)).toBe("2026-11-06T00:00:00.000Z");
    expect(w.localDates).toEqual(["2026-11-04", "2026-11-05"]);
  });

  it("uses BST offsets in summer (tomorrow starts at 23:00Z the day before)", () => {
    const w = computeWindow(new Date("2026-07-10T12:00:00Z"), LONDON, 1);
    expect(iso(w.fromUtc)).toBe("2026-07-10T23:00:00.000Z");
    expect(iso(w.toUtc)).toBe("2026-07-11T23:00:00.000Z");
  });

  it("DST spring-forward day (2026-03-29) has 23h and correct bounds", () => {
    const w = computeWindow(new Date("2026-03-28T12:00:00Z"), LONDON, 1);
    expect(w.localDates).toEqual(["2026-03-29"]);
    expect(iso(w.fromUtc)).toBe("2026-03-29T00:00:00.000Z");
    expect(iso(w.toUtc)).toBe("2026-03-29T23:00:00.000Z");
    expect(hours(w)).toBe(23);
  });

  it("DST fall-back day (2026-10-25) has 25h and correct bounds", () => {
    const w = computeWindow(new Date("2026-10-24T12:00:00Z"), LONDON, 1);
    expect(w.localDates).toEqual(["2026-10-25"]);
    expect(iso(w.fromUtc)).toBe("2026-10-24T23:00:00.000Z");
    expect(iso(w.toUtc)).toBe("2026-10-26T00:00:00.000Z");
    expect(hours(w)).toBe(25);
  });

  it("a two-day window across the spring change spans 47h", () => {
    const w = computeWindow(new Date("2026-03-28T12:00:00Z"), LONDON, 2);
    expect(hours(w)).toBe(47);
    expect(w.localDates).toEqual(["2026-03-29", "2026-03-30"]);
  });

  it("match at 23:30 UTC on a BST day belongs to the next London date", () => {
    // 2026-07-10T23:30Z is 00:30 on 11 July in London.
    const w = computeWindow(new Date("2026-07-10T12:00:00Z"), LONDON, 1); // window = 11 July
    const kickoff = new Date("2026-07-10T23:30:00Z");
    expect(kickoff >= w.fromUtc && kickoff < w.toUtc).toBe(true);
    expect(w.localDates).toEqual(["2026-07-11"]);
  });

  it("midnight edges: 23:59 and 00:00 local pick different 'tomorrow' dates", () => {
    const before = computeWindow(new Date("2026-11-03T23:59:00Z"), LONDON, 1);
    const after = computeWindow(new Date("2026-11-04T00:00:00Z"), LONDON, 1);
    expect(before.localDates).toEqual(["2026-11-04"]);
    expect(after.localDates).toEqual(["2026-11-05"]);
  });

  it("uses the OWNER's timezone, not the server's (Karachi is already on the next day)", () => {
    // 20:00Z on 3 Nov is 01:00 on 4 Nov in Karachi (UTC+5): tomorrow there is 5 Nov.
    const w = computeWindow(new Date("2026-11-03T20:00:00Z"), "Asia/Karachi", 1);
    expect(w.localDates).toEqual(["2026-11-05"]);
    expect(iso(w.fromUtc)).toBe("2026-11-04T19:00:00.000Z");
  });

  it("month and year boundaries roll correctly", () => {
    expect(computeWindow(new Date("2026-12-31T12:00:00Z"), LONDON, 2).localDates).toEqual([
      "2027-01-01",
      "2027-01-02",
    ]);
    expect(computeWindow(new Date("2028-02-28T12:00:00Z"), LONDON, 2).localDates).toEqual([
      "2028-02-29",
      "2028-03-01",
    ]);
  });

  it("rejects windowDays other than 1 or 2 and unknown timezones", () => {
    const now = new Date("2026-11-03T12:00:00Z");
    expect(() => computeWindow(now, LONDON, 3 as 1)).toThrow(RangeError);
    expect(() => computeWindow(now, LONDON, 0 as 1)).toThrow(RangeError);
    expect(() => computeWindow(now, "Mars/Olympus", 1)).toThrow(RangeError);
  });
});

describe("dayRangeFor", () => {
  const now = new Date("2026-11-03T12:00:00Z");

  it("today runs from now to the end of today", () => {
    const r = dayRangeFor("today", now, LONDON);
    expect(r.fromUtc).toEqual(now);
    expect(iso(r.toUtc)).toBe("2026-11-04T00:00:00.000Z");
  });
  it("tomorrow and dayafter are whole local days", () => {
    const t = dayRangeFor("tomorrow", now, LONDON);
    expect([iso(t.fromUtc), iso(t.toUtc)]).toEqual([
      "2026-11-04T00:00:00.000Z",
      "2026-11-05T00:00:00.000Z",
    ]);
    const d = dayRangeFor("dayafter", now, LONDON);
    expect([iso(d.fromUtc), iso(d.toUtc)]).toEqual([
      "2026-11-05T00:00:00.000Z",
      "2026-11-06T00:00:00.000Z",
    ]);
  });
  it("upcoming runs from now onward within the horizon", () => {
    const r = dayRangeFor("upcoming", now, LONDON);
    expect(r.fromUtc).toEqual(now);
    expect(r.toUtc.getTime() - now.getTime()).toBe(UPCOMING_HORIZON_DAYS * 86_400_000);
  });
  it("a match fetched yesterday as 'tomorrow' now falls under Today", () => {
    const kickoff = new Date("2026-11-04T15:00:00Z");
    const yesterday = new Date("2026-11-03T12:00:00Z");
    const today = new Date("2026-11-04T09:00:00Z");
    const inRange = (r: { fromUtc: Date; toUtc: Date }) =>
      kickoff >= r.fromUtc && kickoff < r.toUtc;
    expect(inRange(dayRangeFor("tomorrow", yesterday, LONDON))).toBe(true);
    expect(inRange(dayRangeFor("today", today, LONDON))).toBe(true);
    expect(inRange(dayRangeFor("tomorrow", today, LONDON))).toBe(false);
  });
  it("tab lengths follow DST (spring day is 23h)", () => {
    const r = dayRangeFor("tomorrow", new Date("2026-03-28T12:00:00Z"), LONDON);
    expect(hours(r)).toBe(23);
  });
});
