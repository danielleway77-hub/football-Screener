/**
 * `pnpm db:seed:demo` — loads a realistic DEMO set (fictional-looking pairings) dated from NOW, so the client
 * can see every feature. Safe to re-run: the rows are replaced (same provider ids). Demo rows use provider
 * "demo" and are removed with `pnpm db:seed:demo -- --clear`. Never use against a database with real data
 * you care about unless you pass --clear afterwards.
 */
import { existsSync } from "node:fs";
import { disconnectDb, getDb } from "../src/lib/db";
import { upsertMany } from "../src/server/repositories/matches";
import { createRunning, finish } from "../src/server/repositories/runs";
import { ensureSettings } from "../src/server/repositories/settings";
import type { MatchInput } from "../src/server/repositories/types";

for (const f of [".env.local", ".env"]) {
  if (existsSync(f)) process.loadEnvFile(f);
}

type Demo = {
  id: string;
  home: string;
  away: string;
  league: string;
  country: string;
  inHours: number;
  hf: number;
  af: number;
  hr: string;
  ar: string;
  score: [number, number];
  p: [number, number, number]; // home, draw, away
  btts: number;
  over: number;
};

const DEMO: Demo[] = [
  { id: "d1", home: "Sporting Cristal", away: "FC Cajamarca", league: "Liga 1", country: "Peru", inHours: 5, hf: 80, af: 7, hr: "WWDWW", ar: "LLDLL", score: [3, 1], p: [76, 16, 8], btts: 54, over: 70 },
  { id: "d2", home: "Deportivo Maipú", away: "Club Atlético Pampa", league: "Primera Nacional", country: "Argentina", inHours: 9, hf: 28, af: 84, hr: "LLDLL", ar: "WWWDW", score: [0, 2], p: [9, 17, 74], btts: 38, over: 49 },
  { id: "d3", home: "Rosenborg Fjell", away: "Stavanger Nord", league: "Eliteserien", country: "Norway", inHours: 12, hf: 91, af: 22, hr: "WWWWW", ar: "LLWLL", score: [3, 0], p: [82, 11, 7], btts: 31, over: 66 },
  { id: "d4", home: "Kaizer Valley FC", away: "Soweto Rangers", league: "Premier Division", country: "South Africa", inHours: 20, hf: 77, af: 33, hr: "WDWWW", ar: "LLDLL", score: [2, 0], p: [64, 22, 14], btts: 36, over: 41 },
  { id: "d5", home: "Hanoi Dragons", away: "Da Nang United", league: "V.League 1", country: "Vietnam", inHours: 26, hf: 20, af: 88, hr: "LLLDL", ar: "WWWWD", score: [0, 3], p: [6, 12, 82], btts: 27, over: 63 },
  { id: "d6", home: "Union Bremen", away: "Hamburg Nord 09", league: "2. Bundesliga", country: "Germany", inHours: 30, hf: 82, af: 12, hr: "WWWDW", ar: "LLLLD", score: [3, 1], p: [71, 18, 11], btts: 52, over: 74 },
  { id: "d7", home: "Lyon Bleu", away: "Marseille Port", league: "Ligue 2", country: "France", inHours: 31, hf: 55, af: 48, hr: "WLDWL", ar: "DWLDW", score: [1, 1], p: [36, 31, 33], btts: 58, over: 49 },
  { id: "d8", home: "Porto Alto", away: "Braga Verde", league: "Liga Portugal 2", country: "Portugal", inHours: 34, hf: 75, af: 35, hr: "WWDWW", ar: "LDLLD", score: [2, 1], p: [52, 26, 22], btts: 55, over: 57 },
  { id: "d9", home: "Seoul Eagles", away: "Busan Waves", league: "K League 2", country: "South Korea", inHours: 38, hf: 14, af: 79, hr: "LLLLD", ar: "WWDWW", score: [1, 3], p: [10, 15, 75], btts: 57, over: 72 },
  { id: "d10", home: "Club Olimpia Sur", away: "Cerro Verde", league: "Primera División", country: "Paraguay", inHours: 42, hf: 86, af: 29, hr: "WWWWD", ar: "LLWLL", score: [2, 0], p: [69, 21, 10], btts: 34, over: 45 },
  { id: "d11", home: "Atlético Norte", away: "Real Costa", league: "La Liga 2", country: "Spain", inHours: 44, hf: 62, af: 41, hr: "WDWLW", ar: "LWDLD", score: [1, 0], p: [48, 29, 23], btts: 41, over: 38 },
  { id: "d12", home: "Galatasaray Genç", away: "Konya Spor", league: "1. Lig", country: "Turkey", inHours: 46, hf: 79, af: 18, hr: "WWWWW", ar: "LLLDL", score: [3, 0], p: [78, 15, 7], btts: 29, over: 61 },
  { id: "d13", home: "Tigres del Sur", away: "Leones Rojos", league: "Liga MX Expansión", country: "Mexico", inHours: 47, hf: 90, af: 85, hr: "WWWWW", ar: "WWWDW", score: [2, 2], p: [38, 27, 35], btts: 72, over: 77 },
  { id: "d14", home: "Muscat Stars", away: "Salalah FC", league: "Oman League", country: "Oman", inHours: 40, hf: 8, af: 11, hr: "LLLDL", ar: "LLLLD", score: [0, 0], p: [30, 38, 32], btts: 30, over: 22 },
];

function toInput(d: Demo, now: Date, runId: string | null): MatchInput {
  const strongHome = d.hf > 75 && d.af < 35;
  const strongAway = d.af > 75 && d.hf < 35;
  return {
    provider: "demo",
    providerMatchId: d.id,
    sourceUrl: null,
    league: d.league,
    country: d.country,
    homeLogoUrl: null,
    awayLogoUrl: null,
    homeName: d.home,
    awayName: d.away,
    kickoffAt: new Date(now.getTime() + d.inHours * 3_600_000),
    formScope: "league",
    homeFormPct: d.hf,
    awayFormPct: d.af,
    homeLastResults: d.hr,
    awayLastResults: d.ar,
    pHomeWin: d.p[0],
    pDraw: d.p[1],
    pAwayWin: d.p[2],
    pBtts: d.btts,
    pOver25: d.over,
    predHomeGoals: d.score[0],
    predAwayGoals: d.score[1],
    confidence: null,
    qualifies: strongHome || strongAway,
    strongSide: strongHome ? "HOME" : strongAway ? "AWAY" : null,
    formGap: Math.abs(d.hf - d.af),
    lastRunId: runId,
    fetchedAt: now,
  } as MatchInput;
}

async function main() {
  const db = getDb();
  if (process.argv.includes("--clear")) {
    const r = await db.match.deleteMany({ where: { provider: "demo" } });
    process.stdout.write(`Removed ${r.count} demo matches\n`);
    return;
  }
  await ensureSettings();
  const now = new Date();
  const { run } = await createRunning({ trigger: "IMPORT", provider: "demo", startedAt: now });
  const inputs = DEMO.map((d) => toInput(d, now, run.id));
  await db.match.deleteMany({ where: { provider: "demo" } });
  await upsertMany(inputs, run.id);
  const qualified = inputs.filter((m) => m.qualifies).length;
  await finish(run.id, {
    status: "SUCCESS",
    finishedAt: new Date(),
    scanned: inputs.length,
    qualified,
    failedCount: 0,
  });
  process.stdout.write(`Demo loaded: ${inputs.length} matches, ${qualified} qualify\n`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
