import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FreshnessPill, pillTone } from "@/components/layout/FreshnessPill";
import { TooltipProvider } from "@/components/ui/tooltip";

const NOW = "2026-11-03T12:00:00Z";
const hoursAgo = (h: number) => new Date(new Date(NOW).getTime() - h * 3_600_000).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});
afterEach(() => vi.useRealTimers());

function pill(props: Partial<React.ComponentProps<typeof FreshnessPill>> = {}) {
  return render(
    <TooltipProvider>
      <FreshnessPill
        updatedIso={hoursAgo(2)}
        running={false}
        staleAfterHrs={24}
        nowIso={NOW}
        exactLabel="Today 10:00"
        {...props}
      />
    </TooltipProvider>,
  );
}

describe("FreshnessPill states", () => {
  it("fresh: positive dot, relative text, exact time in the aria-label, links to /runs", () => {
    pill();
    const link = screen.getByTestId("freshness-pill");
    expect(link).toHaveAttribute("data-tone", "positive");
    expect(link).toHaveAttribute("href", "/runs");
    expect(link).toHaveAccessibleName(
      "Updated 2 h ago. Data last updated Today 10:00. View run history.",
    );
    expect(link).toHaveTextContent("Updated 2 h ago");
  });

  it("older than half the stale window turns the dot to warning", () => {
    pill({ updatedIso: hoursAgo(13) });
    expect(screen.getByTestId("freshness-pill")).toHaveAttribute("data-tone", "warning");
  });

  it("stale: warning", () => {
    pill({ updatedIso: hoursAgo(30), exactLabel: "Yesterday 06:00" });
    const link = screen.getByTestId("freshness-pill");
    expect(link).toHaveAttribute("data-tone", "warning");
    expect(link).toHaveTextContent("Updated 1 d ago");
  });

  it("never: faint dot and 'No data yet'", () => {
    pill({ updatedIso: null, exactLabel: null });
    const link = screen.getByTestId("freshness-pill");
    expect(link).toHaveAttribute("data-tone", "faint");
    expect(link).toHaveTextContent("No data yet");
    expect(link).toHaveAccessibleName("No data yet. View run history.");
  });

  it("running: pulsing lime dot and 'Checking…'", () => {
    pill({ running: true });
    const link = screen.getByTestId("freshness-pill");
    expect(link).toHaveAttribute("data-tone", "running");
    expect(link).toHaveTextContent("Checking…");
    expect(link.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("keeps a fixed minimum width so updates never shift the navbar", () => {
    pill();
    expect(screen.getByTestId("freshness-pill").className).toContain("min-w-[150px]");
    expect(screen.getByTestId("freshness-pill").className).toContain("h-8");
  });
});

describe("pillTone", () => {
  it("boundaries: exactly half the window is still positive", () => {
    const now = new Date(NOW).getTime();
    expect(pillTone(now - 12 * 3_600_000, now, 24, false)).toBe("positive");
    expect(pillTone(now - 12 * 3_600_000 - 1, now, 24, false)).toBe("warning");
    expect(pillTone(null, now, 24, true)).toBe("running");
  });
});

describe("FreshnessPill clock", () => {
  it("updates the relative text with fake timers", () => {
    pill({ updatedIso: hoursAgo(1) });
    expect(screen.getByTestId("freshness-pill")).toHaveTextContent("Updated 1 h ago");
    act(() => void vi.advanceTimersByTime(60 * 60_000 + 60_000));
    expect(screen.getByTestId("freshness-pill")).toHaveTextContent("Updated 2 h ago");
  });

  it("pauses while the tab is hidden", () => {
    pill({ updatedIso: hoursAgo(1) });
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    act(() => void vi.advanceTimersByTime(3 * 3_600_000));
    expect(screen.getByTestId("freshness-pill")).toHaveTextContent("Updated 1 h ago");
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByTestId("freshness-pill")).toHaveTextContent("Updated 4 h ago");
  });
});
