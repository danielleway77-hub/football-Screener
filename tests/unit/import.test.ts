import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/import/csv";
import { buildPreview, type ImportContext } from "@/lib/import/model";
import { buildSampleCsv, buildSampleJson } from "@/lib/import/samples";

const ctx: ImportContext = { high: 75, low: 35, formScope: "league" };
const HEADER =
  "id,kickoff,league,home,away,homeForm,awayForm,homeWin,draw,awayWin,btts,over25,predictedHome,predictedAway,formScope";

describe("CSV parser", () => {
  it("handles BOM, quotes, ; delimiter, % signs and comma decimals", () => {
    const csv = `﻿home;away;homeForm;awayForm\r\n"Sporting ""Cristal"", Lima";FC Cajamarca;"80,5%";7 %\r\n`;
    const { delimiter, rows } = parseCsv(csv);
    expect(delimiter).toBe(";");
    expect(rows).toEqual([
      ["home", "away", "homeForm", "awayForm"],
      ['Sporting "Cristal", Lima', "FC Cajamarca", "80,5%", "7 %"],
    ]);

    // End to end: the quoted comma decimal and the spaced percent sign become numbers.
    const preview = buildPreview(
      `﻿kickoff;home;away;homeForm;awayForm\n2026-11-08T19:00:00Z;"Sporting, Cristal";FC Cajamarca;"80,5%";7 %`,
      ctx,
    );
    expect(preview.error).toBeNull();
    expect(preview.rows[0]).toMatchObject({
      valid: true,
      home: "Sporting, Cristal",
      homeForm: 80.5,
      awayForm: 7,
      qualifies: true,
    });
  });

  it("detects commas and tabs, keeps line breaks inside quotes and skips empty lines", () => {
    expect(parseCsv("a,b\n1,2").delimiter).toBe(",");
    expect(parseCsv("a\tb\n1\t2").delimiter).toBe("\t");
    const { rows } = parseCsv('a,b\n\n"line one\nline two",2\n\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["line one\nline two", "2"],
    ]);
  });
});

describe("preview validation (same rules as the server)", () => {
  it("rejects an ambiguous 0.8 and a naive timestamp, naming the row", () => {
    const csv = [
      HEADER,
      "ok,2026-11-08T19:00:00Z,L,A,B,80,7,,,,,,,,league",
      "amb,2026-11-08T19:00:00Z,L,C,D,0.8,7,,,,,,,,league",
      "naive,2026-11-08 19:00,L,E,F,80,7,,,,,,,,league",
    ].join("\n");
    const preview = buildPreview(csv, ctx);
    const byLabel = Object.fromEntries(preview.rows.map((r) => [r.label, r]));
    // Spreadsheet numbering: the header is row 1.
    expect(byLabel["Row 2"]!.valid).toBe(true);
    expect(byLabel["Row 3"]).toMatchObject({ valid: false });
    expect(byLabel["Row 3"]!.reason).toContain("ambiguous");
    expect(byLabel["Row 4"]).toMatchObject({ valid: false, reason: "kickoff has no timezone" });
  });

  it("uses Item numbers for JSON and reports unreadable JSON precisely", () => {
    const json = JSON.stringify({
      matches: [
        {
          kickoffAt: "2026-11-08T19:00:00Z",
          home: { name: "A", formPct: 80 },
          away: { name: "B", formPct: 7 },
        },
        {
          kickoffAt: "2026-11-08T19:00:00Z",
          home: { name: "C", formPct: 80 },
          away: { name: "D" },
        },
      ],
    });
    const preview = buildPreview(json, ctx);
    expect(preview.rows.map((r) => [r.label, r.valid])).toEqual([
      ["Item 1", true],
      ["Item 2", false],
    ]);
    expect(preview.rows[1]!.reason).toBe("away form is missing");
    expect(buildPreview("{ not json", ctx).error).toMatch(/isn't valid JSON/);
  });

  it("preview counts valid / invalid / qualifying with the CURRENT thresholds", () => {
    const rows = [
      "g,2026-11-08T19:00:00Z,L,Golden Home,Golden Away,80,7,,,,,,,,league",
      "e,2026-11-08T19:00:00Z,L,Edge Home,Edge Away,72,38,,,,,,,,league",
      "n,2026-11-08T19:00:00Z,L,Mid Home,Mid Away,50,50,,,,,,,,league",
      "x,2026-11-08T19:00:00Z,L,Bad Home,Bad Away,150,7,,,,,,,,league",
    ];
    const csv = [HEADER, ...rows].join("\n");
    expect(buildPreview(csv, ctx).counts).toEqual({ valid: 3, invalid: 1, qualifying: 1 });
    // At 70/40 the edge match (72 vs 38) qualifies too.
    expect(buildPreview(csv, { ...ctx, high: 70, low: 40 }).counts).toEqual({
      valid: 3,
      invalid: 1,
      qualifying: 2,
    });
  });

  it("flags a form-scope mismatch and a duplicate row, and assumes the settings scope when absent", () => {
    const csv = [
      HEADER,
      "d,2026-11-08T19:00:00Z,L,Dup Home,Dup Away,80,7,,,,,,,,league",
      "d,2026-11-08T19:00:00Z,L,Dup Home,Dup Away,81,7,,,,,,,,league",
      "o,2026-11-08T19:00:00Z,L,Over Home,Over Away,80,7,,,,,,,,overall",
    ].join("\n");
    const preview = buildPreview(csv, ctx);
    expect(preview.counts).toEqual({ valid: 1, invalid: 2, qualifying: 1 });
    expect(preview.rows.find((r) => r.label === "Row 2")!.reason).toContain("duplicate");
    expect(preview.rows.find((r) => r.label === "Row 4")!.reason).toBe(
      "form scope mismatch: expected league",
    );

    const noScope = buildPreview(
      "kickoff,home,away,homeForm,awayForm\n2026-11-08T19:00:00Z,A,B,80,7",
      ctx,
    );
    expect(noScope.counts.valid).toBe(1);
    expect(noScope.notes.join(" ")).toContain("assuming league form");
  });

  it("names missing columns and never imports guessed data", () => {
    expect(buildPreview("home,away\nA,B", ctx).error).toContain(
      "Missing columns: homeForm, awayForm, kickoff",
    );
    expect(buildPreview("   ", ctx).error).toBe("Paste some data or choose a file first.");
  });

  it("the generated samples are valid and contain the golden match and a non-qualifying one", () => {
    const now = new Date("2026-11-03T12:00:00Z");
    for (const sample of [buildSampleJson(now), buildSampleCsv(now)]) {
      const preview = buildPreview(sample, ctx);
      expect(preview.error).toBeNull();
      expect(preview.counts).toEqual({ valid: 2, invalid: 0, qualifying: 1 });
      expect(preview.rows[0]).toMatchObject({
        home: "Sporting Cristal",
        away: "FC Cajamarca",
        homeForm: 80,
        awayForm: 7,
        qualifies: true,
      });
      expect(preview.rows[1]).toMatchObject({
        home: "Atletico Madrid",
        homeForm: 44,
        awayForm: 56,
        qualifies: false,
      });
    }
    expect(buildSampleJson(now)).toContain("2026-11-04T19:00:00Z");
    // The CSV carries the golden extras through to the payload.
    const payload = buildPreview(buildSampleCsv(now), ctx).payload!;
    expect(payload.matches[0]).toMatchObject({
      probabilities: { homeWin: "76", draw: "16", awayWin: "8", btts: "54", over25: "70" },
      predictedScore: { home: 3, away: 1 },
    });
  });
});
