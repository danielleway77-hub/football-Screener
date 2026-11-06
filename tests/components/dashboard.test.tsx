import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
}));

import { NextKickoff } from "@/components/dashboard/NextKickoff";
import { useNowTick } from "@/hooks/useNowTick";
import { useRunPolling, type PolledRun } from "@/hooks/useRunPolling";

beforeEach(() => {
  vi.useFakeTimers();
  window.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useNowTick", () => {
  it("starts at the server instant, then follows the clock every 60 s", () => {
    vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
    const { result } = renderHook(() => useNowTick("2026-11-03T11:59:00Z"));
    expect(result.current).toBe(new Date("2026-11-03T12:00:00Z").getTime());
    act(() => void vi.advanceTimersByTime(60_000));
    expect(result.current).toBe(new Date("2026-11-03T12:01:00Z").getTime());
  });

  it("pauses while the tab is hidden and resumes when it is visible again", () => {
    vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
    const { result } = renderHook(() => useNowTick("2026-11-03T12:00:00Z"));
    act(() => setHidden(true));
    const frozen = result.current;
    act(() => void vi.advanceTimersByTime(5 * 60_000));
    expect(result.current).toBe(frozen);
    act(() => setHidden(false));
    expect(result.current).toBeGreaterThan(frozen);
    setHidden(false);
  });
});

describe("NextKickoff", () => {
  it("shows weekday, time in the owner timezone and a live countdown", () => {
    vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
    render(
      <NextKickoff
        kickoffIso="2026-11-04T17:12:00Z"
        nowIso="2026-11-03T12:00:00Z"
        timezone="Europe/London"
      />,
    );
    expect(screen.getByTestId("next-kickoff")).toHaveTextContent("Wed 17:12 · in 1 d 5 h");
    act(() => void vi.advanceTimersByTime(60 * 60_000 + 60_000));
    expect(screen.getByTestId("next-kickoff")).toHaveTextContent("in 1 d 4 h");
  });
});

describe("useRunPolling", () => {
  const body = (status: PolledRun["status"]) =>
    new Response(
      JSON.stringify({ id: "r1", status, scanned: 5, qualified: 2, failedCount: 0, error: null }),
      { status: 200 },
    );

  it("polls every 2 s and stops on a terminal status", async () => {
    const statuses: PolledRun["status"][] = ["RUNNING", "RUNNING", "SUCCESS"];
    const fetchMock = vi.fn(async () => body(statuses.shift() ?? "SUCCESS"));
    vi.stubGlobal("fetch", fetchMock);
    const onTerminal = vi.fn();
    const onTimeout = vi.fn();
    renderHook(() => useRunPolling("r1", { onTerminal, onTimeout }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(2000)));
    await act(async () => void (await vi.advanceTimersByTimeAsync(2000)));
    expect(onTerminal).not.toHaveBeenCalled();
    await act(async () => void (await vi.advanceTimersByTimeAsync(2000)));
    expect(onTerminal).toHaveBeenCalledTimes(1);
    expect(onTerminal.mock.calls[0]![0]).toMatchObject({ status: "SUCCESS", qualified: 2 });
    const calls = fetchMock.mock.calls.length;
    await act(async () => void (await vi.advanceTimersByTimeAsync(10_000)));
    expect(fetchMock.mock.calls.length).toBe(calls);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("stops polling on unmount", async () => {
    const fetchMock = vi.fn(async () => body("RUNNING"));
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = renderHook(() =>
      useRunPolling("r1", { onTerminal: vi.fn(), onTimeout: vi.fn() }),
    );
    await act(async () => void (await vi.advanceTimersByTimeAsync(2000)));
    const calls = fetchMock.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    unmount();
    await act(async () => void (await vi.advanceTimersByTimeAsync(20_000)));
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("gives up after the 3 minute timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => body("RUNNING")),
    );
    const onTimeout = vi.fn();
    const onTerminal = vi.fn();
    renderHook(() => useRunPolling("r1", { onTerminal, onTimeout }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(3 * 60_000 + 4000)));
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(onTerminal).not.toHaveBeenCalled();
  });

  it("does nothing without a run id", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderHook(() => useRunPolling(null, { onTerminal: vi.fn(), onTimeout: vi.fn() }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(10_000)));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
