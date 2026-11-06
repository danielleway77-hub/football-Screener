import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { parsePageText, splitMatches } from "@/server/domain/parse-page-text";

const fixture = (name: string) => readFileSync(`tests/fixtures/predigoal-text/${name}`, "utf8");

describe("parsePageText", () => {
  it("parses the golden image #2 text: teams, 76/16/8, BTTS 54/46, Over/Under 70/30, predicted 3-1", () => {
    const { matches, problems } = parsePageText(fixture("golden.txt"));
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      home: "Sporting Cristal",
      away: "FC Cajamarca",
      homeForm: 80,
      awayForm: 7,
      homeWin: 76,
      draw: 16,
      awayWin: 8,
      btts: 54,
      over25: 70,
      predictedHome: 3,
      predictedAway: 1,
      kickoffAt: "2026-11-08T19:00:00Z",
      blocked: false,
    });
    expect(problems).toEqual([]);
  });

  it("parses the Recent Form block: Atletico 44 / Bayern 56", () => {
    const { matches } = parsePageText(fixture("atletico.txt"));
    expect(matches[0]).toMatchObject({
      home: "Atlético Madrid",
      away: "Bayern München",
      homeForm: 44,
      awayForm: 56,
      blocked: false,
    });
    // Nothing else was on the page: those fields are unavailable, never 0.
    expect(matches[0]!.homeWin).toBeNull();
    expect(matches[0]!.predictedHome).toBeNull();
    expect(matches[0]!.kickoffAt).toBeNull();
  });

  it("tolerates extra whitespace, line breaks and the AI badges", () => {
    const messy =
      "Sporting Cristal vs FC Cajamarca\n\n\n\nPREDICTED   SCORE   AI\n\n3\n-\n1\nRECENT FORM\n\nSPORTING   CRISTAL\n80 %\nFC\nCAJAMARCA\n7 %";
    const [m] = parsePageText(messy).matches;
    expect(m).toMatchObject({ homeForm: 80, awayForm: 7, predictedHome: 3, predictedAway: 1 });
  });

  it("missing form % for either team -> match marked blocked (never guessed)", () => {
    const text = fixture("golden.txt").replace(/RECENT FORM[\s\S]*$/, "");
    const { matches, problems } = parsePageText(text);
    expect(matches[0]!.homeForm).toBeNull();
    expect(matches[0]!.awayForm).toBeNull();
    expect(matches[0]!.blocked).toBe(true);
    expect(problems).toContain("could not find home team's form %.");
    expect(problems).toContain("could not find away team's form %.");

    const oneSide = fixture("golden.txt").replace("FC CAJAMARCA 7%", "FC CAJAMARCA");
    const [half] = parsePageText(oneSide).matches;
    expect(half!.homeForm).toBe(80);
    expect(half!.awayForm).toBeNull();
    expect(half!.blocked).toBe(true);
  });

  it("unknown layout returns a precise 'could not find <field>' list", () => {
    const { matches, problems } = parsePageText("Hello there, this is not a match page at all.");
    expect(matches[0]!.blocked).toBe(true);
    expect(problems).toEqual(
      expect.arrayContaining([
        "could not find home team name.",
        "could not find away team name.",
        "could not find home team's form %.",
        "could not find predicted score.",
      ]),
    );
  });

  it("several matches pasted back-to-back are split correctly", () => {
    const text = `${fixture("golden.txt")}\n\n${fixture("atletico.txt")}`;
    expect(splitMatches(text)).toHaveLength(2);
    const { matches } = parsePageText(text);
    expect(matches.map((m) => [m.home, m.homeForm, m.awayForm])).toEqual([
      ["Sporting Cristal", 80, 7],
      ["Atlético Madrid", 44, 56],
    ]);
    // Without "A vs B" headers, 2+ blank lines still separate matches.
    const bare = "RECENT FORM\nAAA 90%\nBBB 10%\n\n\nRECENT FORM\nCCC 20%\nDDD 80%";
    expect(parsePageText(bare).matches.map((m) => [m.homeForm, m.awayForm])).toEqual([
      [90, 10],
      [20, 80],
    ]);
  });

  it("reads percent values with and without the % sign, and comma decimals", () => {
    const text = "A vs B\nWIN A 70\nWIN B 20\nDRAW 10\nRECENT FORM\nA 80,5\nB 7";
    const [m] = parsePageText(text).matches;
    expect(m).toMatchObject({ homeWin: 70, awayWin: 20, draw: 10 });
    // No % sign on the form values: numbers are still found only when followed by '%' in the form block.
    expect(m!.homeForm).toBeNull();
    const withSign = parsePageText("A vs B\nRECENT FORM\nA 80,5%\nB 7 %").matches[0]!;
    expect(withSign).toMatchObject({ homeForm: 80.5, awayForm: 7 });
  });

  it("caps at 20 matches and says so", () => {
    const many = Array.from(
      { length: 22 },
      (_, i) => `T${i}a vs T${i}b\nRECENT FORM\nT${i}a 90%\nT${i}b 10%`,
    ).join("\n");
    const { matches, problems } = parsePageText(many);
    expect(matches).toHaveLength(20);
    expect(problems[0]).toContain("Only the first 20 matches");
  });

  it("an empty paste explains what to do", () => {
    expect(parsePageText("   \n ")).toEqual({
      matches: [],
      problems: ["Paste the text of a match page first."],
    });
  });

  it("makes no network access and imports nothing outside the domain", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    parsePageText(fixture("golden.txt"));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    const source = readFileSync("src/server/domain/parse-page-text.ts", "utf8");
    expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|^import /m);
  });
});
