import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

const motionPrefs = vi.hoisted(() => ({ reduce: true }));
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => motionPrefs.reduce,
}));

import { duelAriaLabel, duelLayout } from "@/components/match/duel-logic";
import { FormDuel } from "@/components/match/FormDuel";

beforeAll(() => {
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  window.IntersectionObserver ??= IO as unknown as typeof IntersectionObserver;
});

const duel = (home: number, away: number, qualifies: boolean) => (
  <FormDuel
    home={{ name: "Sporting Cristal", logoUrl: null, pct: home }}
    away={{ name: "FC Cajamarca", logoUrl: null, pct: away }}
    low={35}
    high={75}
    qualifies={qualifies}
  />
);

describe("FormDuel layout rules", () => {
  it("marker positions equal pct, clamped to 2-98", () => {
    expect(duelLayout(80, 7)).toMatchObject({
      homeLeft: 80,
      awayLeft: 7,
      gap: 73,
      from: 7,
      to: 80,
    });
    expect(duelLayout(100, 0)).toMatchObject({ homeLeft: 98, awayLeft: 2 });
    expect(duelLayout(0, 100)).toMatchObject({ homeLeft: 2, awayLeft: 98 });
  });
  it("overlap offsets the lower marker, only below 8 points", () => {
    expect(duelLayout(50, 50).below).toBe("away"); // tie: home counts as higher
    expect(duelLayout(40, 47.9).below).toBe("home");
    expect(duelLayout(40, 48).below).toBeNull();
    expect(duelLayout(40, 49).below).toBeNull();
  });
  it("aria-label has both teams, both percentages, gap and verdict", () => {
    const base = { homeName: "A", awayName: "B", low: 35, high: 75 };
    expect(duelAriaLabel({ ...base, homePct: 80, awayPct: 7, qualifies: true })).toBe(
      "A 80 percent, B 7 percent, gap 73 points. Rule: one team above 75 and the other below 35. Qualifies.",
    );
    expect(duelAriaLabel({ ...base, homePct: 75, awayPct: 35, qualifies: false })).toMatch(
      /gap 40 points.*Does not qualify\.$/,
    );
  });
});

describe("FormDuel", () => {
  it("renders one image sentence and puts the markers at their positions", () => {
    render(duel(80, 7, true));
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Sporting Cristal 80 percent"),
    );
    expect(img).toHaveAttribute("aria-label", expect.stringContaining("FC Cajamarca 7 percent"));
    expect(img).toHaveAttribute("aria-label", expect.stringContaining("gap 73 points"));
    expect(img).toHaveAttribute("aria-label", expect.stringMatching(/Qualifies\.$/));
    expect(screen.getByTestId("duel-marker-home")).toHaveAttribute("data-left", "80");
    expect(screen.getByTestId("duel-marker-away")).toHaveAttribute("data-left", "7");
    expect(screen.getByTestId("duel-pill")).toHaveTextContent("gap 73 pts");
    expect(screen.getAllByTestId("duel-tick").map((t) => t.getAttribute("data-at"))).toEqual([
      "35",
      "75",
    ]);
  });
  it("reduced motion shows the final state immediately", () => {
    render(duel(80, 7, true));
    expect(screen.getByTestId("duel-marker-home")).toHaveStyle({ left: "80%" });
    expect(screen.getByTestId("duel-bracket")).toHaveStyle({ opacity: "1" });
  });
  it("75/35 bracket is neutral, 76/34 is lime", () => {
    const { unmount } = render(duel(75, 35, false));
    expect(screen.getByTestId("duel-bracket").className).toContain("bg-faint");
    expect(screen.getByTestId("duel-bracket").className).not.toContain("bg-primary");
    unmount();
    render(duel(76, 34, true));
    expect(screen.getByTestId("duel-bracket").className).toContain("bg-primary");
  });
  it("50/50 puts one marker below the track with a leader line; both stay rendered", () => {
    render(duel(50, 50, false));
    expect(screen.getByTestId("duel-marker-away")).toHaveAttribute("data-below", "true");
    expect(screen.getByTestId("duel-marker-home")).not.toHaveAttribute("data-below");
    expect(screen.getAllByTestId("duel-leader")).toHaveLength(1);
    expect(screen.getAllByTestId("team-logo")).toHaveLength(2);
  });
  it("zones follow the thresholds from props", () => {
    render(duel(80, 7, true));
    expect(screen.getByTestId("zone-low")).toHaveStyle({ width: "35%" });
    expect(screen.getByTestId("zone-mid")).toHaveStyle({ width: "40%" });
  });
});
