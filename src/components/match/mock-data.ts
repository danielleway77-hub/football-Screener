import type { MatchCardData } from "./MatchCard";

/** Mock cards for the dev-only style guide and for component tests (never used by real pages). */
const base: MatchCardData = {
  id: "mock",
  league: "Peru · Liga 1",
  kickoffLabel: "Wed 4 Nov · 19:45",
  relativeLabel: "in 1 day",
  qualifies: true,
  strongSide: "HOME",
  formScope: "league",
  home: { name: "Sporting Cristal", logoUrl: null, pct: 80 },
  away: { name: "FC Cajamarca", logoUrl: null, pct: 7 },
  probabilities: { homeWin: 76, draw: 16, awayWin: 8, btts: 54, over25: 70 },
  predicted: { home: 3, away: 1 },
  confidence: null,
};

/** The client's image #2: 80/7 form; 76/16/8; BTTS 54/46; Over/Under 70/30; predicted 3-1. */
export const GOLDEN_CARD: MatchCardData = { ...base, id: "golden" };

export const MOCK_CARDS: { label: string; data: MatchCardData }[] = [
  { label: "Default (golden fixture, image 2)", data: GOLDEN_CARD },
  {
    label: "Away strong",
    data: {
      ...base,
      id: "away-strong",
      strongSide: "AWAY",
      home: { name: "Home Weak FC", logoUrl: null, pct: 30 },
      away: { name: "Away Strong United", logoUrl: null, pct: 82 },
      probabilities: { homeWin: 12, draw: 18, awayWin: 70, btts: 40, over25: 55 },
      predicted: { home: 0, away: 2 },
    },
  },
  {
    label: "60-character names",
    data: {
      ...base,
      id: "long",
      league: "Democratic Republic of the Congo · Linafoot Ligue 1 Championship",
      home: {
        name: "Real Club Deportivo Espanyol de Barcelona Sociedad Anonima Deportiva",
        logoUrl: null,
        pct: 78,
      },
      away: {
        name: "Association Sportive Saint-Etienne Loire Football Club Association",
        logoUrl: null,
        pct: 12,
      },
    },
  },
  {
    label: "Null probabilities (3 of 5 missing)",
    data: {
      ...base,
      id: "nulls",
      probabilities: { homeWin: 70, draw: null, awayWin: null, btts: null, over25: 61 },
    },
  },
  {
    label: "BTTS 50/50 tie",
    data: { ...base, id: "btts-tie", probabilities: { ...base.probabilities, btts: 50 } },
  },
  { label: "No predicted score", data: { ...base, id: "no-score", predicted: null } },
  {
    label: "1X2 tie for first",
    data: {
      ...base,
      id: "tie",
      probabilities: { homeWin: 40, draw: 40, awayWin: 20, btts: 54, over25: 70 },
    },
  },
  {
    label: "0% and 100% values",
    data: {
      ...base,
      id: "extremes",
      home: { name: "Always Win FC", logoUrl: null, pct: 100 },
      away: { name: "Never Win FC", logoUrl: null, pct: 0 },
      probabilities: { homeWin: 100, draw: 0, awayWin: 0, btts: 0, over25: 100 },
    },
  },
  {
    label: "Confidence chip",
    data: { ...base, id: "confidence", confidence: "HIGH" },
  },
  {
    label: "No longer qualifies",
    data: { ...base, id: "no-longer", qualifies: false, strongSide: null },
  },
  {
    label: "Overall form scope, decimals",
    data: {
      ...base,
      id: "overall",
      formScope: "overall",
      home: { name: "Decimal Town", logoUrl: null, pct: 75.4 },
      away: { name: "Point Five United", logoUrl: null, pct: 34.5 },
    },
  },
];
