import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
}));

import { MatchHero } from "@/components/match/MatchHero";
import { MatchPager } from "@/components/match/MatchPager";
import { ProbabilityPanel } from "@/components/match/ProbabilityPanel";

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

const home = { name: "Sporting Cristal", logoUrl: null };
const away = { name: "FC Cajamarca", logoUrl: null };
const full = { homeWin: 76, draw: 16, awayWin: 8, btts: 54, over25: 70 };
const none = { homeWin: null, draw: null, awayWin: null, btts: null, over25: null };
const panel = (probabilities: typeof full | typeof none, score: [number, number] | null = null) => (
  <ProbabilityPanel
    home={home}
    away={away}
    probabilities={probabilities}
    predictedHome={score?.[0] ?? null}
    predictedAway={score?.[1] ?? null}
  />
);

describe("ProbabilityPanel", () => {
  it("highest bar is lime and the others neutral", () => {
    render(panel(full, [3, 1]));
    const rows = screen.getAllByTestId("prob-row");
    expect(rows.map((r) => r.getAttribute("data-highest"))).toEqual(["true", null, null]);
    const fills = screen.getAllByTestId("prob-track").map((t) => t.firstElementChild!.className);
    expect(fills[0]).toContain("bg-primary");
    expect(fills[1]).toContain("bg-neutral-bar");
    expect(fills[2]).toContain("bg-neutral-bar");
    expect(screen.getByRole("group", { name: "Exact probabilities" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Predicted score 3 1" })).toBeInTheDocument();
  });
  it("derives No and Under and marks the larger tile", () => {
    render(panel(full));
    expect(
      screen.getByRole("group", { name: "Both teams to score No: 46 percent (calculated)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Over / Under 2.5 goals Under: 30 percent (calculated)" }),
    ).toBeInTheDocument();
    const lead = screen.getAllByTestId("prob-tile").filter((t) => t.hasAttribute("data-lead"));
    expect(lead).toHaveLength(2);
  });
  it("null values read Unavailable and never 0; no highlight; no predicted score hides the hero", () => {
    render(panel(none));
    expect(screen.queryByTestId("predicted-score-tile")).toBeNull();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryAllByTestId("prob-row").some((r) => r.hasAttribute("data-highest"))).toBe(
      false,
    );
    expect(document.body.textContent).not.toMatch(/\b0%/);
  });
  it("a 1X2 tie or a missing value has no highlight", () => {
    const { unmount } = render(panel({ ...full, homeWin: 40, awayWin: 40, draw: 20 }));
    expect(screen.getAllByTestId("prob-row").some((r) => r.hasAttribute("data-highest"))).toBe(
      false,
    );
    unmount();
    render(panel({ ...full, draw: null } as unknown as typeof full));
    expect(screen.getAllByTestId("prob-row").some((r) => r.hasAttribute("data-highest"))).toBe(
      false,
    );
  });
});

describe("MatchPager", () => {
  it("disables the ends with visible text, not a tooltip", () => {
    render(<MatchPager previous={null} next={{ href: "/matches/b", label: "A vs B" }} />);
    expect(screen.getByTestId("pager-previous")).toBeDisabled();
    expect(screen.getByText("This is the first qualifying match.")).toBeVisible();
    const next = screen.getByRole("link", { name: /Next match: A vs B/ });
    expect(next).toHaveAttribute("href", "/matches/b");
    expect(next).toHaveAttribute("title", "A vs B");
  });
  it("last match", () => {
    render(<MatchPager previous={{ href: "/matches/a", label: "X vs Y" }} next={null} />);
    expect(screen.getByText("This is the last qualifying match.")).toBeVisible();
  });
});

describe("MatchHero", () => {
  const props = {
    home,
    away,
    competition: "Peru · Liga 1",
    kickoff: "Wed 4 Nov · 19:45",
    relative: "in 1 day",
    qualifies: true,
    strongName: "Sporting Cristal",
    scopeLabel: "League form",
    confidence: null,
    low: 35,
    high: 75,
  } as const;
  it("one h2 per team, strong caption, no note when qualifying", () => {
    render(<MatchHero {...props} confidence="HIGH" />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Sporting Cristal",
      "FC Cajamarca",
    ]);
    expect(screen.getByText("QUALIFIES")).toBeInTheDocument();
    expect(screen.getByTestId("confidence")).toHaveTextContent("Confidence HIGH");
    expect(screen.queryByTestId("no-longer-note")).toBeNull();
  });
  it("amber note with thresholds and a settings link when no longer qualifying", () => {
    render(<MatchHero {...props} qualifies={false} strongName={null} competition={null} />);
    const note = screen.getByTestId("no-longer-note");
    expect(note).toHaveTextContent(
      "No longer qualifies under your current thresholds (75% / 35%).",
    );
    expect(within(note).getByRole("link", { name: "Change thresholds" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(screen.getByText("NO LONGER QUALIFIES")).toBeInTheDocument();
    expect(screen.queryByText("Strong:", { exact: false })).toBeNull();
  });
  it("renders hostile names as text", () => {
    render(<MatchHero {...props} home={{ name: "<script>x</script>", logoUrl: null }} />);
    expect(screen.getByRole("heading", { name: "<script>x</script>" })).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });
});
