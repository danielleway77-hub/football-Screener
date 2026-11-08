/**
 * Smart paste (mode C-lite, decision D18): turns text the OWNER copied from a match page herself into
 * match candidates. Pure and forgiving, but it NEVER guesses: a value it cannot find is `null`
 * ("Unavailable"), and a match without both teams' form % is `blocked` (it cannot be screened).
 * No network access, no I/O — the text is the only input.
 */

export type ParsedPageMatch = {
  home: string | null;
  away: string | null;
  homeForm: number | null;
  awayForm: number | null;
  homeWin: number | null;
  draw: number | null;
  awayWin: number | null;
  btts: number | null;
  over25: number | null;
  predictedHome: number | null;
  predictedAway: number | null;
  league: string | null;
  /** An absolute instant (ISO with Z/offset) when the text carried one; otherwise null (owner confirms). */
  kickoffAt: string | null;
  /** Human labels of everything that was not found, e.g. "home team's form %". */
  missing: string[];
  /** True when the match cannot be imported as parsed (names or either form % missing). */
  blocked: boolean;
};

export type ParseResult = {
  matches: ParsedPageMatch[];
  /** Precise "could not find …" lines for the whole paste (empty when everything was found). */
  problems: string[];
};

const MAX_MATCHES = 20;
const NUM = String.raw`(\d{1,3}(?:[.,]\d{1,2})?)`;
const toNumber = (raw: string): number => Number(raw.replace(",", "."));
const valid = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;

/** "ATLETICO MADRID" -> "Atletico Madrid" (only when the whole name is upper case). */
function tidyName(raw: string): string {
  const name = raw
    .replace(/\s+/g, " ")
    .replace(/^[\s:–—-]+|[\s:–—-]+$/g, "")
    .trim();
  if (name !== name.toUpperCase() || name === name.toLowerCase()) return name;
  return name
    .toLowerCase()
    .replace(/(^|[\s'’-])(\p{L})/gu, (_m, sep: string, c: string) => sep + c.toUpperCase());
}

/** Removes form letters (W D L) and "AI" badges that sit between the numbers on the page. */
function stripNoise(raw: string): string {
  return raw
    .replace(/\b(?:AI|PRO|NEW|PREMIUM)\b/g, " ")
    .replace(/(?:^|\s)(?:[WDL](?=\s|$))+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HEADER = /^\s*(.{2,60}?)\s+(?:vs\.?|v)\s+(.{2,60}?)\s*$/i;

/** Splits the paste into one chunk per match (header "A vs B" lines, else 2+ blank lines, else one). */
export function splitMatches(text: string): string[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const headers: number[] = [];
  lines.forEach((line, i) => {
    if (line.length <= 120 && !/%/.test(line) && HEADER.test(line)) headers.push(i);
  });
  let chunks: string[];
  if (headers.length >= 1) {
    chunks = headers.map((start, k) =>
      lines.slice(start, headers[k + 1] ?? lines.length).join("\n"),
    );
  } else {
    chunks = text
      .replace(/\r\n?/g, "\n")
      .split(/\n[ \t]*\n[ \t]*\n+|\n\s*(?:-{3,}|={3,})\s*\n/)
      .filter((c) => c.trim());
  }
  return chunks.filter((c) => c.trim().length > 0);
}

function parseChunk(chunk: string): ParsedPageMatch {
  const flat = chunk.replace(/\s+/g, " ").trim();

  // Teams: the "A vs B" header line when present; otherwise the names inside the WIN lines.
  let home: string | null = null;
  let away: string | null = null;
  for (const line of chunk.split("\n")) {
    const m = HEADER.exec(line);
    if (m && !/%/.test(line)) {
      home = tidyName(m[1]!);
      away = tidyName(m[2]!);
      break;
    }
  }

  // WIN <team> 76%  — PrediGoal lists home first, then away, then DRAW.
  // Team names may contain digits ("Schalke 04"): prefer values that carry a "%", else accept bare numbers.
  const winsWithPct = [
    ...flat.matchAll(new RegExp(String.raw`\bWIN\s+([^%]{2,60}?)\s*[:\-]?\s*${NUM}\s*%`, "gi")),
  ];
  const wins =
    winsWithPct.length >= 2
      ? winsWithPct
      : [
          ...flat.matchAll(
            new RegExp(String.raw`\bWIN\s+([^%\d]{2,60}?)\s*[:\-]?\s*${NUM}\s*%?`, "gi"),
          ),
        ];
  const winHome = wins[0];
  const winAway = wins[1];
  if (!home && winHome) home = tidyName(winHome[1]!);
  if (!away && winAway) away = tidyName(winAway[1]!);
  const homeWin = winHome ? toNumber(winHome[2]!) : null;
  const awayWin = winAway ? toNumber(winAway[2]!) : null;
  const drawMatch = new RegExp(String.raw`\bDRAW\s*[:\-]?\s*${NUM}\s*%?`, "i").exec(flat);
  const draw = drawMatch ? toNumber(drawMatch[1]!) : null;

  const score = /PREDICTED\s+SCORE\D{0,20}?(\d{1,2})\s*[-–:]\s*(\d{1,2})/i.exec(flat);
  const btts = new RegExp(
    String.raw`BOTH\s+TEAMS\s+TO\s+SCORE.{0,60}?\bYES\b\D{0,12}${NUM}\s*%?`,
    "i",
  ).exec(flat);
  const over = new RegExp(
    String.raw`OVER\s*/?\s*UNDER\s*2[.,]5.{0,80}?\bOVER\b\D{0,12}${NUM}\s*%?`,
    "i",
  ).exec(flat);

  // Recent form block: "<NAME> 44% … <NAME> 56%" (letters W/D/L and AI badges may sit in between).
  let homeForm: number | null = null;
  let awayForm: number | null = null;
  const formIdx = flat.search(/RECENT\s+FORM/i);
  if (formIdx >= 0) {
    const after = flat.slice(formIdx).replace(/^RECENT\s+FORM/i, " ");
    const pairs: { name: string; pct: number }[] = [];
    let rest = after;
    while (pairs.length < 2) {
      const m = new RegExp(String.raw`^(.*?)${NUM}\s*%`).exec(rest);
      if (!m) break;
      const name = stripNoise(m[1]!);
      if (name) pairs.push({ name, pct: toNumber(m[2]!) });
      rest = rest.slice(m[0].length);
    }
    const same = (a: string, b: string | null) =>
      b !== null && a.toLowerCase().includes(b.toLowerCase());
    const used = new Set<number>();
    pairs.forEach((pair, i) => {
      if (home && homeForm === null && same(pair.name, home)) {
        homeForm = pair.pct;
        used.add(i);
      } else if (away && awayForm === null && same(pair.name, away)) {
        awayForm = pair.pct;
        used.add(i);
      }
    });
    // Names did not line up (e.g. a different spelling): use the page order (home first), but only when
    // exactly two values were found. A single leftover is given to the side that is still empty.
    if (pairs.length === 2) {
      const rest = pairs.filter((_, i) => !used.has(i));
      if (homeForm === null && awayForm === null) {
        homeForm = pairs[0]!.pct;
        awayForm = pairs[1]!.pct;
        if (!home) home = tidyName(pairs[0]!.name);
        if (!away) away = tidyName(pairs[1]!.name);
      } else if (rest.length === 1) {
        if (homeForm === null) homeForm = rest[0]!.pct;
        else if (awayForm === null) awayForm = rest[0]!.pct;
      }
    }
  }

  const kickoff = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})/i.exec(flat);
  const league =
    /\b(?:LEAGUE|COMPETITION)\s*[:\-]\s*([^|]{2,60}?)(?=\s{2,}|$|\s(?:[A-Z]{3,}\s))/i.exec(chunk);

  const pick = (n: number | null) => (n !== null && valid(n) ? n : null);
  const result: ParsedPageMatch = {
    home,
    away,
    homeForm: pick(homeForm),
    awayForm: pick(awayForm),
    homeWin: pick(homeWin),
    draw: pick(draw),
    awayWin: pick(awayWin),
    btts: btts ? pick(toNumber(btts[1]!)) : null,
    over25: over ? pick(toNumber(over[1]!)) : null,
    predictedHome: score ? Number(score[1]) : null,
    predictedAway: score ? Number(score[2]) : null,
    league: league ? tidyName(league[1]!) : null,
    kickoffAt: kickoff ? kickoff[0].replace(" ", "T") : null,
    missing: [],
    blocked: false,
  };

  const need: [boolean, string][] = [
    [result.home === null, "home team name"],
    [result.away === null, "away team name"],
    [result.homeForm === null, "home team's form %"],
    [result.awayForm === null, "away team's form %"],
  ];
  const optional: [boolean, string][] = [
    [
      result.homeWin === null || result.draw === null || result.awayWin === null,
      "win / draw / win probabilities",
    ],
    [result.btts === null, "both teams to score"],
    [result.over25 === null, "over 2.5 goals"],
    [result.predictedHome === null, "predicted score"],
  ];
  result.missing = [...need, ...optional]
    .filter(([isMissing]) => isMissing)
    .map(([, label]) => label);
  result.blocked = need.some(([isMissing]) => isMissing);
  return result;
}

/** Parses everything the owner pasted. At most 20 matches; the rest are reported in `problems`. */
export function parsePageText(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { matches: [], problems: ["Paste the text of a match page first."] };
  const chunks = splitMatches(trimmed);
  const problems: string[] = [];
  const matches = chunks.slice(0, MAX_MATCHES).map(parseChunk);
  if (chunks.length > MAX_MATCHES) {
    problems.push(`Only the first ${MAX_MATCHES} matches were read (${chunks.length} found).`);
  }
  matches.forEach((m, i) => {
    const label = matches.length > 1 ? `Match ${i + 1}: ` : "";
    for (const field of m.missing) problems.push(`${label}could not find ${field}.`);
  });
  return { matches, problems };
}
