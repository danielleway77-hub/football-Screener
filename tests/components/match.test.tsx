import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Reduced motion = final values render immediately (no counting), which is what these tests assert.
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
}));

import { FormBadges } from "@/components/match/FormBadges";
import { FormBar } from "@/components/match/FormBar";
import { derived, formStrength, highest1x2, pairLeader } from "@/components/match/logic";
import { MatchCard } from "@/components/match/MatchCard";
import { GOLDEN_CARD, MOCK_CARDS } from "@/components/match/mock-data";
import { PairTile } from "@/components/match/PairTile";
import { PredictedScore } from "@/components/match/PredictedScore";
import { ProbabilityGrid } from "@/components/match/ProbabilityGrid";
import { TeamLogo } from "@/components/match/TeamLogo";

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

const card = (id: string) => MOCK_CARDS.find((c) => c.data.id === id)!.data;

describe("FormBar", () => {
  it("shows strong, average, poor states with icon + label", () => {
    const { rerender } = render(<FormBar pct={80} low={35} high={75} teamName="A" />);
    expect(screen.getByText("Strong form")).toBeInTheDocument();
    expect(screen.getByRole("img").closest("[data-strength]")).toHaveAttribute(
      "data-strength",
      "strong",
    );
    rerender(<FormBar pct={50} low={35} high={75} teamName="A" />);
    expect(screen.getByText("Average")).toBeInTheDocument();
    rerender(<FormBar pct={7} low={35} high={75} teamName="A" />);
    expect(screen.getByText("Poor form")).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeInTheDocument(); // the strength icon
  });

  it("uses strict thresholds: exactly high or low is average", () => {
    expect(formStrength(75, 35, 75)).toBe("average");
    expect(formStrength(35, 35, 75)).toBe("average");
    expect(formStrength(75.1, 35, 75)).toBe("strong");
    expect(formStrength(34.9, 35, 75)).toBe("poor");
    expect(formStrength(0, 35, 75)).toBe("poor");
    expect(formStrength(100, 35, 75)).toBe("strong");
  });

  it("takes thresholds from props (a 60/20 rule changes the state)", () => {
    render(<FormBar pct={65} low={20} high={60} teamName="A" />);
    expect(screen.getByText("Strong form")).toBeInTheDocument();
  });

  it("places tick marks at the low and high thresholds", () => {
    render(<FormBar pct={50} low={35} high={75} teamName="A" />);
    const ticks = screen.getAllByTestId("form-tick");
    expect(ticks.map((t) => (t as HTMLElement).style.left)).toEqual(["35%", "75%"]);
    for (const tick of ticks) expect(tick).toHaveAttribute("aria-hidden", "true");
  });

  it("aria-label includes team, percent and the rule", () => {
    render(<FormBar pct={44} low={35} high={75} teamName="Atletico Madrid" />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Atletico Madrid form 44 percent, average. Rule: strong above 75, poor below 35.",
    );
  });

  it("handles 0, 100 and one decimal", () => {
    const { rerender } = render(<FormBar pct={0} low={35} high={75} teamName="A" />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/form 0 percent, poor/);
    rerender(<FormBar pct={100} low={35} high={75} teamName="A" />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/form 100 percent, strong/);
    rerender(<FormBar pct={62.46} low={35} high={75} teamName="A" />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/form 62.5 percent/);
  });
});

describe("FormBadges", () => {
  it("renders letters with Win/Draw/Loss labels, oldest left, newest right", () => {
    render(<FormBadges results="WDL" />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((i) => i.getAttribute("aria-label"))).toEqual(["Win", "Draw", "Loss"]);
    expect(items.map((i) => i.textContent)).toEqual(["W", "D", "L"]);
  });
  it("keeps only the last five valid results and renders nothing when empty", () => {
    const { container, rerender } = render(<FormBadges results="WWWWWWLx" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    rerender(<FormBadges results="" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<FormBadges results={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("display rules", () => {
  it("highlights the highest 1X2 only when all three are present and there is no tie", () => {
    expect(highest1x2(76, 16, 8)).toBe("home");
    expect(highest1x2(10, 20, 70)).toBe("away");
    expect(highest1x2(40, 40, 20)).toBeNull();
    expect(highest1x2(33, 33, 33)).toBeNull();
    expect(highest1x2(76, null, 8)).toBeNull();
  });
  it("makes the larger of a pair the leader, nobody on a tie", () => {
    expect(pairLeader(54, 46)).toBe("a");
    expect(pairLeader(30, 70)).toBe("b");
    expect(pairLeader(50, 50)).toBeNull();
    expect(pairLeader(null, 50)).toBeNull();
  });
  it("derives No and Under as 100 minus the stored value", () => {
    expect(derived(54)).toBe(46);
    expect(derived(70)).toBe(30);
    expect(derived(62.5)).toBe(37.5);
    expect(derived(null)).toBeNull();
  });
});

describe("ProbabilityGrid", () => {
  it("marks only the highest 1X2 tile and keeps the order Home, Draw, Away", () => {
    render(<ProbabilityGrid probabilities={GOLDEN_CARD.probabilities} />);
    const tiles = screen.getAllByTestId("prob-tile");
    expect(tiles.map((t) => t.getAttribute("aria-label"))).toEqual([
      "Home win: 76%",
      "Draw: 16%",
      "Away win: 8%",
    ]);
    expect(tiles.map((t) => t.hasAttribute("data-highest"))).toEqual([true, false, false]);
  });
  it("highlights nothing on a tie or when a value is missing", () => {
    const { rerender } = render(
      <ProbabilityGrid probabilities={{ ...GOLDEN_CARD.probabilities, homeWin: 40, draw: 40 }} />,
    );
    expect(document.querySelectorAll("[data-highest]")).toHaveLength(0);
    rerender(<ProbabilityGrid probabilities={{ ...GOLDEN_CARD.probabilities, draw: null }} />);
    expect(document.querySelectorAll("[data-highest]")).toHaveLength(0);
  });
  it("shows Unavailable and never 0 for missing values", () => {
    render(
      <ProbabilityGrid
        probabilities={{ homeWin: null, draw: null, awayWin: 20, btts: null, over25: null }}
      />,
    );
    expect(screen.getAllByText("Unavailable")).toHaveLength(4);
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("prob-tile")[0]).toHaveAttribute("data-missing", "true");
  });
  it("renders 0% as a real value, not as missing", () => {
    render(
      <ProbabilityGrid
        probabilities={{ homeWin: 0, draw: 0, awayWin: 100, btts: 0, over25: 100 }}
      />,
    );
    expect(screen.getAllByTestId("prob-tile")[0]).toHaveAttribute("aria-label", "Home win: 0%");
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
  });
});

describe("PairTile", () => {
  it("makes the larger value lime and says the second is calculated", () => {
    render(
      <PairTile
        label="Both teams score"
        shortLabel="BTTS"
        aLabel="Yes"
        aValue={54}
        bLabel="No"
        bValue={46}
      />,
    );
    const tile = screen.getByTestId("pair-tile");
    expect(tile).toHaveAccessibleName(
      "Both teams score: Yes 54 percent, No 46 percent (calculated)",
    );
    const leads = tile.querySelectorAll("[data-lead]");
    expect(leads).toHaveLength(1);
    expect(leads[0]).toHaveTextContent("54%");
  });
  it("has no lime value on a tie", () => {
    render(<PairTile label="L" shortLabel="S" aLabel="Yes" aValue={50} bLabel="No" bValue={50} />);
    expect(document.querySelectorAll("[data-lead]")).toHaveLength(0);
  });
  it("shows Unavailable (not 0) when the source value is missing", () => {
    render(
      <PairTile label="L" shortLabel="S" aLabel="Yes" aValue={null} bLabel="No" bValue={null} />,
    );
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByTestId("pair-tile")).toHaveAttribute("data-missing", "true");
  });
});

describe("PredictedScore", () => {
  it("is hidden when absent and has a screen-reader sentence when present", () => {
    const { container, rerender } = render(<PredictedScore home={null} away={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<PredictedScore home={3} away={1} />);
    expect(screen.getByText("Predicted score 3 1 from the data source")).toBeInTheDocument();
  });
  it("renders a 0-0 prediction (zero is a value)", () => {
    render(<PredictedScore home={0} away={0} />);
    expect(screen.getByTestId("predicted-score")).toBeInTheDocument();
  });
});

describe("TeamLogo", () => {
  it("falls back to two uppercase letters without a logo", () => {
    render(<TeamLogo name="sporting cristal" />);
    expect(screen.getByText("SP")).toBeInTheDocument();
  });
  it("ignores non-https sources", () => {
    const { container } = render(<TeamLogo name="Abc" src="http://insecure.example/a.png" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("AB")).toBeInTheDocument();
  });
  it("renders an image with explicit dimensions for an https source", () => {
    const { container } = render(<TeamLogo name="Abc" src="https://cdn.example/a.png" size={40} />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("width", "40");
    expect(img).toHaveAttribute("height", "40");
  });
});

describe("MatchCard", () => {
  it("is a single link and contains no other interactive element", () => {
    const { container } = render(<MatchCard data={GOLDEN_CARD} low={35} high={75} />);
    const article = container.querySelector("article")!;
    expect(article.querySelectorAll("a")).toHaveLength(1);
    expect(article.querySelectorAll("button, input, select, textarea, [tabindex]")).toHaveLength(0);
    const link = within(article).getByRole("link");
    expect(link).toHaveAttribute("href", "/matches/golden");
    expect(link).toHaveAccessibleName(
      "Sporting Cristal vs FC Cajamarca, qualifies, Sporting Cristal form 80 percent, strong",
    );
  });

  it("truncates long names to one line and keeps the full name in title", () => {
    const data = card("long");
    render(<MatchCard data={data} low={35} high={75} />);
    const heading = screen.getByRole("heading", { name: data.home.name });
    expect(heading).toHaveAttribute("title", data.home.name);
    expect(heading.className).toContain("truncate");
  });

  it("renders the golden fixture: 76/16/8, 54/46, 70/30 and the score 3 - 1", () => {
    render(<MatchCard data={GOLDEN_CARD} low={35} high={75} />);
    const grid = screen.getByTestId("probability-grid");
    expect(
      within(grid)
        .getAllByTestId("prob-tile")
        .map((t) => t.getAttribute("aria-label")),
    ).toEqual(["Home win: 76%", "Draw: 16%", "Away win: 8%"]);
    const pairs = within(grid)
      .getAllByTestId("pair-tile")
      .map((t) => t.getAttribute("aria-label"));
    expect(pairs).toEqual([
      "Both teams score: Yes 54 percent, No 46 percent (calculated)",
      "Over / Under 2.5: Over 70 percent, Under 30 percent (calculated)",
    ]);
    expect(screen.getByText("Predicted score 3 1 from the data source")).toBeInTheDocument();
    expect(screen.getByText("Strong: Sporting Cristal · League form")).toBeInTheDocument();
  });

  it("hides the predicted score and the confidence chip when absent, shows them when present", () => {
    const { rerender } = render(<MatchCard data={card("no-score")} low={35} high={75} />);
    expect(screen.queryByTestId("predicted-score")).not.toBeInTheDocument();
    expect(screen.queryByTestId("confidence-chip")).not.toBeInTheDocument();
    rerender(<MatchCard data={card("confidence")} low={35} high={75} />);
    expect(screen.getByTestId("confidence-chip")).toHaveTextContent("HIGH");
  });

  it("names the away team as strong in the away-strong case without reordering teams", () => {
    render(<MatchCard data={card("away-strong")} low={35} high={75} />);
    const names = screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(names).toEqual(["Home Weak FC", "Away Strong United"]);
    expect(screen.getByText("Strong: Away Strong United · League form")).toBeInTheDocument();
  });

  it("switches the chip to the warning variant when it no longer qualifies", () => {
    render(<MatchCard data={card("no-longer")} low={35} high={75} />);
    expect(screen.getByTestId("qualifies-chip")).toHaveTextContent("NO LONGER QUALIFIES");
  });
});
