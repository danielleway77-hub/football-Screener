import * as React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prefs = vi.hoisted(() => ({ reduce: false }));
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => prefs.reduce,
}));

import { CardSheen } from "@/components/motion/CardSheen";
import { SpotlightCard } from "@/components/motion/SpotlightCard";
import { MatchCard, type MatchCardData } from "@/components/match/MatchCard";

type Cb = (entries: { isIntersecting: boolean }[]) => void;
let callbacks: Cb[] = [];
let disconnects = 0;
class IO {
  constructor(cb: Cb) {
    callbacks.push(cb);
  }
  observe() {}
  disconnect() {
    disconnects++;
  }
  unobserve() {}
}

beforeEach(() => {
  prefs.reduce = false;
  callbacks = [];
  disconnects = 0;
  vi.stubGlobal("IntersectionObserver", IO);
});
afterEach(() => vi.unstubAllGlobals());

describe("CardSheen (15.1 qualifying-card sheen)", () => {
  it("is idle until the card is on screen, and pauses again when it leaves", () => {
    render(<CardSheen />);
    const sheen = screen.getByTestId("card-sheen");
    expect(sheen).toHaveAttribute("data-active", "false");
    act(() => callbacks[0]!([{ isIntersecting: true }]));
    expect(sheen).toHaveAttribute("data-active", "true");
    act(() => callbacks[0]!([{ isIntersecting: false }]));
    expect(sheen).toHaveAttribute("data-active", "false");
  });

  it("does not observe anything under reduced motion", () => {
    prefs.reduce = true;
    render(<CardSheen />);
    expect(callbacks).toHaveLength(0);
    expect(screen.getByTestId("card-sheen")).toHaveAttribute("data-active", "false");
  });

  it("disconnects the observer on unmount", () => {
    const { unmount } = render(<CardSheen />);
    unmount();
    expect(disconnects).toBe(1);
  });

  it("is aria-hidden decoration", () => {
    render(<CardSheen />);
    expect(screen.getByTestId("card-sheen")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("SpotlightCard element + attributes (15.4)", () => {
  it("renders the requested element and forwards data attributes and content class", () => {
    render(
      <SpotlightCard as="article" data-testid="sc" contentClassName="p-4">
        hello
      </SpotlightCard>,
    );
    const el = screen.getByTestId("sc");
    expect(el.tagName).toBe("ARTICLE");
    expect(el.firstElementChild?.className).toContain("p-4");
  });
});

const card: MatchCardData = {
  id: "m1",
  league: "Peru · Liga 1",
  kickoffLabel: "Wed 4 Nov · 19:45",
  qualifies: true,
  strongSide: "HOME",
  formScope: "league",
  home: { name: "Sporting Cristal", logoUrl: null, pct: 80 },
  away: { name: "FC Cajamarca", logoUrl: null, pct: 7 },
  probabilities: { homeWin: 76, draw: 16, awayWin: 8, btts: 54, over25: 70 },
  predicted: { home: 3, away: 1 },
  confidence: "HIGH",
};

describe("MatchCard polish wiring", () => {
  it("qualifying cards carry the sheen, others do not", () => {
    const { rerender } = render(<MatchCard data={card} low={35} high={75} />);
    expect(screen.getAllByTestId("card-sheen")).toHaveLength(1);
    rerender(<MatchCard data={{ ...card, qualifies: false }} low={35} high={75} />);
    expect(screen.queryByTestId("card-sheen")).toBeNull();
  });

  it("is still ONE link and an article wrapped by the spotlight layer", () => {
    render(<MatchCard data={card} low={35} high={75} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByTestId("match-card").tagName).toBe("ARTICLE");
    expect(screen.getByTestId("match-card")).toHaveAttribute("data-spotlight");
  });
});
