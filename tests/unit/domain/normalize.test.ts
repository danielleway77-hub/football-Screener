import { describe, expect, it } from "vitest";
import { normalizePayload, normalizePercent, PayloadError } from "@/server/domain/normalize";
import { parseRawMatch, rawMatchInputSchema } from "@/server/domain/schema";

type Item = Record<string, unknown>;

/** The golden fixture from client image #2, as a provider would send it. */
const golden = (): Item => ({
  provider: "predigoal",
  providerMatchId: "1549544",
  sourceUrl: "https://predigoal.com/match/1549544",
  kickoffAt: "2026-11-04T00:30:00Z",
  league: "Peru Liga 1",
  country: "Peru",
  home: { name: "Sporting Cristal", formPct: "80%", lastResults: ["W", "W", "D", "W", "W"] },
  away: { name: "FC Cajamarca", formPct: 7, lastResults: "LLLDL" },
  formScope: "league",
  probabilities: { homeWin: 76, draw: 16, awayWin: 8, btts: 54, over25: 70 },
  predictedScore: { home: 3, away: 1 },
  confidence: "high",
});

const reason = (mutate: (i: Item) => void, scale?: "percent" | "fraction") => {
  const item = golden();
  mutate(item);
  const r = parseRawMatch(item, scale);
  return r.ok ? "OK" : r.reason;
};

describe("normalizePercent", () => {
  it('"80%", "80 %", 80 and "80.0" all normalise to 80', () => {
    for (const v of ["80%", "80 %", 80, "80.0", " 80 ", 80.0]) {
      expect(normalizePercent(v)).toEqual({ ok: true, value: 80 });
    }
  });
  it("bare 0.8 is rejected as ambiguous", () => {
    const r = normalizePercent(0.8);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toMatch(/ambiguous/);
    expect(normalizePercent("0.8").ok).toBe(false);
    expect(normalizePercent(1).ok).toBe(false);
  });
  it("0.8 is accepted only with percentScale fraction (→ 80), and 0.07 → 7 without float noise", () => {
    expect(normalizePercent(0.8, "fraction")).toEqual({ ok: true, value: 80 });
    expect(normalizePercent(0.07, "fraction")).toEqual({ ok: true, value: 7 });
    expect(normalizePercent(1, "fraction")).toEqual({ ok: true, value: 100 });
    expect(normalizePercent(0, "fraction")).toEqual({ ok: true, value: 0 });
    expect(normalizePercent(80, "fraction").ok).toBe(false);
  });
  it('an explicit "%" is never ambiguous ("0.8%" is 0.8)', () => {
    expect(normalizePercent("0.8%")).toEqual({ ok: true, value: 0.8 });
    expect(normalizePercent("0.8%", "fraction")).toEqual({ ok: true, value: 0.8 });
  });
  it("0 is a valid percentage (the 100/0 fixture)", () => {
    expect(normalizePercent(0)).toEqual({ ok: true, value: 0 });
    expect(normalizePercent(100)).toEqual({ ok: true, value: 100 });
  });
  it("rejects NaN, infinity, negatives, values above 100 and non-numeric input", () => {
    for (const v of [
      Number.NaN,
      Infinity,
      -5,
      120,
      "120%",
      "abc",
      "",
      "1e2",
      null,
      undefined,
      true,
      {},
      "80%%",
    ]) {
      expect(normalizePercent(v).ok, String(v)).toBe(false);
    }
    expect(normalizePercent("-5").ok).toBe(false);
  });
});

describe("rawMatchInputSchema / parseRawMatch", () => {
  it("accepts the golden fixture and stores it exactly", () => {
    const r = parseRawMatch(golden());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.home).toEqual({ name: "Sporting Cristal", formPct: 80, lastResults: "WWDWW" });
    expect(r.value.away.formPct).toBe(7);
    expect(r.value.probabilities).toEqual({
      homeWin: 76,
      draw: 16,
      awayWin: 8,
      btts: 54,
      over25: 70,
    });
    expect(r.value.predictedScore).toEqual({ home: 3, away: 1 });
    expect(r.value.confidence).toBe("HIGH");
    expect(r.value.kickoffAt.toISOString()).toBe("2026-11-04T00:30:00.000Z");
    expect(rawMatchInputSchema.safeParse(golden()).success).toBe(true);
  });

  it("rejects a naive timestamp with 'kickoff has no timezone'", () => {
    expect(reason((i) => (i.kickoffAt = "2026-11-04T19:45:00"))).toBe("kickoff has no timezone");
  });
  it("accepts an explicit offset and converts to the right instant", () => {
    const r = parseRawMatch({ ...golden(), kickoffAt: "2026-11-04T19:45:00+01:00" });
    expect(r.ok && r.value.kickoffAt.toISOString()).toBe("2026-11-04T18:45:00.000Z");
  });
  it("rejects a malformed or impossible kickoff", () => {
    expect(reason((i) => (i.kickoffAt = "2026-13-45T10:00:00Z"))).toMatch(/not a valid date/);
    expect(reason((i) => (i.kickoffAt = "tomorrow Z"))).toMatch(/not a valid date/);
    expect(reason((i) => (i.kickoffAt = 12345))).toMatch(/not text/);
    expect(reason((i) => delete i.kickoffAt)).toBe("kickoff time is missing");
  });

  it("missing home form rejects the item", () => {
    expect(reason((i) => (i.home = { name: "A" }))).toBe("home form is missing");
    expect(reason((i) => (i.away = { name: "B", formPct: "" }))).toBe("away form is missing");
  });
  it("value 120 is rejected", () => {
    expect(reason((i) => (i.home = { name: "A", formPct: 120 }))).toBe(
      "home form must be between 0 and 100",
    );
  });
  it('percent strings normalise ("80%" / "7 %")', () => {
    const r = parseRawMatch({
      ...golden(),
      home: { name: "A", formPct: "80%" },
      away: { name: "B", formPct: "7 %" },
    });
    expect(r.ok && [r.value.home.formPct, r.value.away.formPct]).toEqual([80, 7]);
  });
  it("bare 0.8 form is rejected unless the scale is fraction", () => {
    const m = { home: { name: "A", formPct: 0.8 }, away: { name: "B", formPct: 0.07 } };
    expect(reason((i) => Object.assign(i, m))).toMatch(/ambiguous/);
    const ok = parseRawMatch({ ...golden(), ...m, probabilities: {} }, "fraction");
    expect(ok.ok && [ok.value.home.formPct, ok.value.away.formPct]).toEqual([80, 7]);
  });

  it("probabilities missing become undefined, not 0", () => {
    const r = parseRawMatch({ ...golden(), probabilities: undefined, predictedScore: undefined });
    expect(r.ok && r.value.probabilities).toEqual({});
    const partial = parseRawMatch({
      ...golden(),
      probabilities: { btts: 54, homeWin: "", draw: null },
    });
    expect(partial.ok && partial.value.probabilities).toEqual({ btts: 54 });
    expect(r.ok && r.value.predictedScore).toBeUndefined();
  });
  it("win/draw/win 76+16+8 accepted, 34+33+34 (sum 101) accepted, 70+30+30 (sum 130) rejected with the sum", () => {
    const p = (homeWin: number, draw: number, awayWin: number) => (i: Item) =>
      (i.probabilities = { homeWin, draw, awayWin });
    expect(reason(p(76, 16, 8))).toBe("OK");
    expect(reason(p(34, 33, 34))).toBe("OK");
    expect(reason(p(70, 30, 30))).toBe(
      "win/draw/win probabilities add up to 130, expected about 100",
    );
    expect(reason(p(30, 30, 30))).toBe(
      "win/draw/win probabilities add up to 90, expected about 100",
    );
    expect(reason(p(49, 49, 0))).toBe("OK"); // 98 is inside the tolerance
    expect(reason(p(34, 34, 34))).toBe("OK"); // 102 too
    expect(reason(p(34, 34, 35))).toMatch(/add up to 103/);
    expect(reason(p(48, 49, 0))).toMatch(/add up to 97/);
  });
  it("a partial 1X2 (only home win) is not sum-checked", () => {
    expect(reason((i) => (i.probabilities = { homeWin: 90 }))).toBe("OK");
  });
  it("each probability must be 0–100 and not ambiguous", () => {
    expect(reason((i) => (i.probabilities = { btts: 120 }))).toBe(
      "both-teams-to-score probability must be between 0 and 100",
    );
    expect(reason((i) => (i.probabilities = { over25: 0.7 }))).toMatch(
      /over 2.5 probability is ambiguous/,
    );
    expect(reason((i) => (i.probabilities = "lots"))).toBe("probabilities are malformed");
  });

  it("predictedScore 3–1 accepted, 3.5–1 and 25–0 rejected", () => {
    expect(reason((i) => (i.predictedScore = { home: 3, away: 1 }))).toBe("OK");
    expect(reason((i) => (i.predictedScore = { home: 3.5, away: 1 }))).toBe(
      "predicted home goals must be a whole number from 0 to 20",
    );
    expect(reason((i) => (i.predictedScore = { home: 25, away: 0 }))).toBe(
      "predicted home goals must be a whole number from 0 to 20",
    );
    expect(reason((i) => (i.predictedScore = { home: 1, away: -1 }))).toBe(
      "predicted away goals must be a whole number from 0 to 20",
    );
    expect(reason((i) => (i.predictedScore = [3, 1]))).toBe("predicted score is malformed");
  });

  it("strings are trimmed and length-capped", () => {
    const r = parseRawMatch({ ...golden(), providerMatchId: "  42  ", league: "  Liga  " });
    expect(r.ok && [r.value.providerMatchId, r.value.league]).toEqual(["42", "Liga"]);
    expect(reason((i) => (i.home = { name: "x".repeat(81), formPct: 80 }))).toBe(
      "home team name is longer than 80 characters",
    );
    expect(reason((i) => (i.league = "x".repeat(81)))).toBe("league is longer than 80 characters");
    expect(reason((i) => (i.providerMatchId = "x".repeat(65)))).toBe(
      "match id is longer than 64 characters",
    );
    expect(reason((i) => (i.home = { name: "   ", formPct: 80 }))).toBe(
      "home team name is missing",
    );
  });
  it("numeric ids are accepted as text", () => {
    const r = parseRawMatch({ ...golden(), providerMatchId: 1549544 });
    expect(r.ok && r.value.providerMatchId).toBe("1549544");
  });
  it("non-https URLs are rejected", () => {
    expect(reason((i) => (i.sourceUrl = "http://predigoal.com/x"))).toBe(
      "source link must be an https link",
    );
    expect(
      reason((i) => (i.home = { name: "A", formPct: 80, logoUrl: "javascript:alert(1)" })),
    ).toBe("home logo must be an https link");
    expect(reason((i) => (i.sourceUrl = "not a url"))).toBe("source link must be an https link");
    expect(reason((i) => (i.sourceUrl = 5))).toBe("source link is not a link");
    expect(reason((i) => (i.sourceUrl = "https://x.com/" + "a".repeat(500)))).toBe(
      "source link must be an https link",
    );
  });
  it("lastResults: up to 5 of W/D/L, case-insensitive; invalid rejected", () => {
    expect(reason((i) => (i.away = { name: "B", formPct: 7, lastResults: "wdlwd" }))).toBe("OK");
    expect(reason((i) => (i.away = { name: "B", formPct: 7, lastResults: "WWWWWW" }))).toBe(
      "away last results must be up to 5 of W, D or L",
    );
    expect(reason((i) => (i.away = { name: "B", formPct: 7, lastResults: "WXL" }))).toBe(
      "away last results must be up to 5 of W, D or L",
    );
    expect(reason((i) => (i.away = { name: "B", formPct: 7, lastResults: 5 }))).toBe(
      "away last results are not text",
    );
  });
  it("formScope and confidence are enums", () => {
    expect(reason((i) => (i.formScope = "season"))).toBe("form scope must be league or overall");
    expect(reason((i) => delete i.formScope)).toBe("form scope is missing");
    expect(reason((i) => (i.confidence = "SURE"))).toBe("confidence must be LOW, MEDIUM or HIGH");
    expect(reason((i) => delete i.confidence)).toBe("OK");
  });
  it("structural problems have readable reasons", () => {
    expect(parseRawMatch("nope")).toEqual({ ok: false, reason: "item is not an object" });
    expect(parseRawMatch([])).toEqual({ ok: false, reason: "item is not an object" });
    expect(reason((i) => delete i.home)).toBe("home team is missing");
    expect(reason((i) => (i.away = "B"))).toBe("away team is missing");
    expect(reason((i) => delete i.provider)).toBe("provider is missing");
    expect(reason((i) => (i.league = {}))).toBe("league is not text");
  });
});

describe("normalizePayload", () => {
  it("returns valid and invalid items with human reasons", () => {
    const bad = golden();
    bad.providerMatchId = "bad-1";
    bad.home = { name: "A" };
    const r = normalizePayload({ matches: [golden(), bad] });
    expect(r.valid).toHaveLength(1);
    expect(r.invalid).toEqual([{ index: 1, id: "bad-1", reason: "home form is missing" }]);
    expect(r.duplicates).toBe(0);
  });

  it("duplicate ids in one payload: last wins and is counted once", () => {
    const first = golden();
    const last = golden();
    (last.home as Item).formPct = 90;
    const other = { ...golden(), providerMatchId: "other" };
    const r = normalizePayload({ matches: [first, other, last] });
    expect(r.valid).toHaveLength(2);
    expect(r.duplicates).toBe(1);
    const kept = r.valid.find((m) => m.providerMatchId === "1549544")!;
    expect(kept.home.formPct).toBe(90);
    expect(r.valid.map((m) => m.providerMatchId)).toEqual(["other", "1549544"]);
  });

  it("percentScale fraction applies to the whole payload", () => {
    const item = {
      ...golden(),
      home: { name: "A", formPct: 0.8 },
      away: { name: "B", formPct: 0.07 },
      probabilities: {},
    };
    expect(normalizePayload({ matches: [item] }).invalid).toHaveLength(1);
    const r = normalizePayload({ matches: [item], percentScale: "fraction" });
    expect(r.invalid).toEqual([]);
    expect(r.valid[0]!.home.formPct).toBe(80);
  });

  it("all-invalid payload yields no valid items (the run service decides FAILED)", () => {
    const r = normalizePayload({ matches: [{}, "x", null] });
    expect(r.valid).toEqual([]);
    expect(r.invalid.map((i) => i.index)).toEqual([0, 1, 2]);
    expect(r.invalid[1]!.reason).toBe("item is not an object");
  });

  it("ids in invalid items are truncated and numeric ids are reported", () => {
    const r = normalizePayload({
      matches: [{ providerMatchId: 77 }, { providerMatchId: "z".repeat(100) }],
    });
    expect(r.invalid[0]!.id).toBe("77");
    expect(r.invalid[1]!.id).toHaveLength(64);
  });

  it("throws PayloadError for an unusable payload (empty, too large, wrong shape)", () => {
    expect(() => normalizePayload({ matches: [] })).toThrow(PayloadError);
    expect(() => normalizePayload({ matches: Array.from({ length: 501 }, () => ({})) })).toThrow(
      /at most 500/,
    );
    expect(() => normalizePayload(null)).toThrow(/payload must be an object/);
    expect(() => normalizePayload({ matches: "x" })).toThrow(/must be a list/);
    expect(() => normalizePayload({ matches: [golden()], percentScale: "ratio" })).toThrow(
      PayloadError,
    );
  });

  it("accepts exactly 500 items", () => {
    const matches = Array.from({ length: 500 }, (_, n) => ({
      ...golden(),
      providerMatchId: `id-${n}`,
    }));
    expect(normalizePayload({ matches }).valid).toHaveLength(500);
  });
});

describe("minimal and blank optional fields", () => {
  const minimal = () => ({
    provider: "p",
    providerMatchId: "1",
    kickoffAt: "2026-11-04T10:00:00Z",
    home: { name: "A", formPct: 80 },
    away: { name: "B", formPct: 7 },
    formScope: "league",
  });

  it("a minimal item (only required fields) is valid and carries no optional keys", () => {
    const r = parseRawMatch(minimal());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.probabilities).toEqual({});
    expect(Object.keys(r.value).sort()).toEqual(
      [
        "away",
        "formScope",
        "home",
        "kickoffAt",
        "probabilities",
        "provider",
        "providerMatchId",
      ].sort(),
    );
  });

  it("explicit null / blank optional fields behave like missing ones", () => {
    const r = parseRawMatch({
      ...minimal(),
      sourceUrl: null,
      league: "  ",
      country: null,
      probabilities: null,
      predictedScore: null,
      confidence: "",
      home: { name: "A", formPct: 80, logoUrl: "", lastResults: "" },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.league).toBeUndefined();
    expect(r.value.predictedScore).toBeUndefined();
    expect(r.value.home).toEqual({ name: "A", formPct: 80 });
  });

  it("a valid https logo is kept; confidence must be text", () => {
    const r = parseRawMatch({
      ...minimal(),
      home: { name: "A", formPct: 80, logoUrl: "https://x.com/a.png" },
    });
    expect(r.ok && r.value.home.logoUrl).toBe("https://x.com/a.png");
    expect(parseRawMatch({ ...minimal(), confidence: 5 })).toEqual({
      ok: false,
      reason: "confidence must be LOW, MEDIUM or HIGH",
    });
  });
});
