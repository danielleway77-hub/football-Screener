import { describe, expect, it } from "vitest";
import { groupByLocalDate } from "@/lib/day-groups";

const m = (id: string, iso: string) => ({ id, kickoffAt: new Date(iso) });
const NOW = new Date("2026-11-03T12:00:00Z");

describe("groupByLocalDate", () => {
  it("groups by local date, in chronological order, with Today / Tomorrow labels", () => {
    const groups = groupByLocalDate(
      [
        m("c", "2026-11-05T10:00:00Z"),
        m("a", "2026-11-03T15:00:00Z"),
        m("b1", "2026-11-04T10:00:00Z"),
        m("b2", "2026-11-04T18:00:00Z"),
      ],
      "Europe/London",
      NOW,
    );
    expect(groups.map((g) => g.label)).toEqual([
      "Today · Tue 3 Nov",
      "Tomorrow · Wed 4 Nov",
      "Thu 5 Nov",
    ]);
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([["a"], ["b1", "b2"], ["c"]]);
  });

  it("assigns a match just after local midnight to the next day (UK summer time)", () => {
    // 23:30 UTC on 4 Jul is 00:30 on 5 Jul in London (BST).
    const groups = groupByLocalDate(
      [m("late", "2026-07-04T22:30:00Z"), m("midnight", "2026-07-04T23:30:00Z")],
      "Europe/London",
      new Date("2026-07-04T10:00:00Z"),
    );
    expect(groups.map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([
      ["2026-07-04", ["late"]],
      ["2026-07-05", ["midnight"]],
    ]);
  });

  it("is correct on the DST days (23 h and 25 h)", () => {
    // 29 Mar 2026: clocks go forward at 01:00 UTC. 00:30 UTC is still GMT (00:30), 01:30 UTC is BST (02:30).
    const spring = groupByLocalDate(
      [
        m("x", "2026-03-28T23:59:00Z"),
        m("y", "2026-03-29T22:59:00Z"),
        m("z", "2026-03-29T23:00:00Z"),
      ],
      "Europe/London",
      new Date("2026-03-28T12:00:00Z"),
    );
    expect(spring.map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([
      ["2026-03-28", ["x"]],
      ["2026-03-29", ["y"]],
      ["2026-03-30", ["z"]],
    ]);
    // 25 Oct 2026: clocks go back; the local day is 25 hours long. "Tomorrow" from 24 Oct is 25 Oct.
    const autumn = groupByLocalDate(
      [m("p", "2026-10-25T00:30:00Z"), m("q", "2026-10-25T23:30:00Z")],
      "Europe/London",
      new Date("2026-10-24T12:00:00Z"),
    );
    expect(autumn.map((g) => g.label)).toEqual(["Tomorrow · Sun 25 Oct"]);
  });

  it("uses the owner timezone, not the server timezone", () => {
    const groups = groupByLocalDate([m("n", "2026-11-03T20:00:00Z")], "Pacific/Auckland", NOW);
    expect(groups[0]!.key).toBe("2026-11-04");
    expect(groups[0]!.label).toBe("Today · Wed 4 Nov"); // it is already the 4th there
  });

  it("keeps the incoming order inside a group (a form-gap sort applies within each day)", () => {
    const sortedByGap = [
      m("big-late", "2026-11-04T20:00:00Z"),
      m("big-day2", "2026-11-05T10:00:00Z"),
      m("small-early", "2026-11-04T08:00:00Z"),
    ];
    const groups = groupByLocalDate(sortedByGap, "Europe/London", NOW);
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([
      ["big-late", "small-early"],
      ["big-day2"],
    ]);
  });

  it("returns no groups for no matches", () => {
    expect(groupByLocalDate([], "Europe/London", NOW)).toEqual([]);
  });
});
