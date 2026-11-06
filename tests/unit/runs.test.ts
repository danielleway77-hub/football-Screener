import { describe, expect, it } from "vitest";
import { parseDetails, runDurationText, isAbandoned } from "@/lib/run-view";
import { parseRunsParams, runsHref } from "@/lib/schemas/runs";
import { pageWindow } from "@/components/shared/Pagination";

describe("parseRunsParams", () => {
  it("defaults", () => {
    expect(parseRunsParams({})).toEqual({ page: 1, status: null, showSkipped: false });
  });
  it("accepts valid values", () => {
    expect(parseRunsParams({ page: "3", status: "FAILED", showSkipped: "1" })).toEqual({
      page: 3,
      status: "FAILED",
      showSkipped: true,
    });
  });
  it("falls back on garbage", () => {
    expect(parseRunsParams({ page: "-4", status: "NOPE", showSkipped: "x" })).toEqual({
      page: 1,
      status: null,
      showSkipped: false,
    });
    expect(parseRunsParams({ page: "99999999" }).page).toBe(1);
  });
  it("runsHref omits defaults", () => {
    expect(runsHref({ page: 1 })).toBe("/runs");
    expect(runsHref({ page: 2, status: "PARTIAL", showSkipped: true })).toBe(
      "/runs?status=PARTIAL&showSkipped=1&page=2",
    );
  });
});

describe("run view helpers", () => {
  const now = new Date("2026-11-05T10:00:30Z");
  it("duration: finished, running, abandoned, unfinished", () => {
    const base = { startedAt: "2026-11-05T10:00:00Z", error: null };
    expect(
      runDurationText({ ...base, status: "SUCCESS", finishedAt: "2026-11-05T10:00:04Z" }, now),
    ).toBe("4s");
    expect(runDurationText({ ...base, status: "RUNNING", finishedAt: null }, now)).toBe("30s…");
    expect(
      runDurationText(
        {
          ...base,
          status: "FAILED",
          error: "Run did not finish and was marked failed.",
          finishedAt: "2026-11-05T10:11:00Z",
        },
        now,
      ),
    ).toBe("timed out");
    expect(runDurationText({ ...base, status: "FAILED", finishedAt: null }, now)).toBe("—");
    expect(isAbandoned({ status: "SUCCESS", error: "Run did not finish" })).toBe(false);
  });
  it("parseDetails keeps well-formed items and caps at 200", () => {
    const raw = [
      { index: 1, id: "a", reason: "bad" },
      { nope: true },
      ...Array.from({ length: 300 }, (_, i) => ({ index: i, reason: "r" })),
    ];
    const out = parseDetails(raw);
    expect(out).toHaveLength(200);
    expect(out[0]).toEqual({ index: 1, id: "a", reason: "bad" });
    expect(parseDetails("x")).toEqual([]);
  });
  it("pageWindow", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, "gap", 20]);
  });
});
