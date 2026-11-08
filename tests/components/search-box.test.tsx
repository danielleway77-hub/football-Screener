import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
}));

import { DashboardNavProvider } from "@/components/dashboard/DashboardNav";
import { FilterBar } from "@/components/dashboard/MatchFilters";

const counts = { upcoming: 0, today: 0, tomorrow: 0, dayafter: 0 };
const ui = (q: string) => (
  <DashboardNavProvider params={{ day: "upcoming", q, sort: "kickoff" }}>
    <FilterBar counts={counts} windowDays={2} caption="" />
  </DashboardNavProvider>
);

beforeEach(() => {
  vi.useFakeTimers();
  replace.mockClear();
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  window.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});
afterEach(() => vi.useRealTimers());

describe("league search box", () => {
  it("keeps newer typing when the URL echo of an older query arrives", () => {
    const view = render(ui(""));
    const input = screen.getByLabelText("Filter by league") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "peru" } });
    act(() => void vi.advanceTimersByTime(300));
    expect(replace).toHaveBeenCalledWith("/?q=peru", { scroll: false });
    // The user keeps typing while the navigation is still in flight...
    fireEvent.change(input, { target: { value: "peru l" } });
    // ...then the server answers with the OLD query.
    view.rerender(ui("peru"));
    expect(input.value).toBe("peru l");
  });

  it("still follows an external change (Clear filters / Back)", () => {
    const view = render(ui("peru"));
    const input = screen.getByLabelText("Filter by league") as HTMLInputElement;
    expect(input.value).toBe("peru");
    view.rerender(ui(""));
    expect(input.value).toBe("");
  });
});
