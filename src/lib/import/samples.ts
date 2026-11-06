/**
 * Sample files for the Import page. Kickoffs are built from the click time (tomorrow, UTC) so a fresh
 * sample always lands inside the screening window. Contains the golden example (client image #2:
 * Sporting Cristal vs FC Cajamarca, 80/7, win 76 · draw 16 · away 8, BTTS 54, Over 70, predicted 3-1)
 * and a non-qualifying match (Atletico Madrid 44 / Bayern Munchen 56).
 */
function tomorrowAt(now: Date, hour: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, hour));
  return d.toISOString().replace(".000Z", "Z");
}

export function buildSampleJson(now: Date): string {
  return JSON.stringify(
    {
      matches: [
        {
          provider: "manual",
          providerMatchId: "sporting-cristal-fc-cajamarca",
          kickoffAt: tomorrowAt(now, 19),
          league: "Liga 1",
          country: "Peru",
          home: { name: "Sporting Cristal", formPct: 80 },
          away: { name: "FC Cajamarca", formPct: 7 },
          formScope: "league",
          probabilities: { homeWin: 76, draw: 16, awayWin: 8, btts: 54, over25: 70 },
          predictedScore: { home: 3, away: 1 },
        },
        {
          provider: "manual",
          providerMatchId: "atletico-madrid-bayern-munchen",
          kickoffAt: tomorrowAt(now, 20),
          league: "Champions League",
          country: "Europe",
          home: { name: "Atletico Madrid", formPct: 44 },
          away: { name: "Bayern Munchen", formPct: 56 },
          formScope: "league",
        },
      ],
    },
    null,
    2,
  );
}

export function buildSampleCsv(now: Date): string {
  return [
    "id,kickoff,league,country,home,away,homeForm,awayForm,homeWin,draw,awayWin,btts,over25,predictedHome,predictedAway,formScope",
    `sporting-cristal-fc-cajamarca,${tomorrowAt(now, 19)},Liga 1,Peru,Sporting Cristal,FC Cajamarca,80%,7%,76,16,8,54,70,3,1,league`,
    `atletico-madrid-bayern-munchen,${tomorrowAt(now, 20)},Champions League,Europe,Atletico Madrid,Bayern Munchen,44%,56%,,,,,,,,league`,
    "",
  ].join("\n");
}

export const SAMPLE_PLACEHOLDER = `[
  { "kickoffAt": "2026-11-08T19:00:00Z", "home": { "name": "Team A", "formPct": 80 },
    "away": { "name": "Team B", "formPct": 7 }, "formScope": "league" }
]`;

/** Triggers a browser download of generated text (no network involved). */
export function downloadText(filename: string, mime: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
