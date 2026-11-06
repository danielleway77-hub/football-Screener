import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { normalizePayload, PayloadError } from "@/server/domain/normalize";
import type { ParsedPageMatch } from "@/server/domain/parse-page-text";
import { checkFormScope, evaluateMatch } from "@/server/domain/screening";
import type { FormScope, PercentScale } from "@/server/domain/types";
import { parseCsv } from "./csv";

/** Everything the CLIENT-side preview needs from the saved settings (same rule as the server). */
export type ImportContext = { high: number; low: number; formScope: FormScope };

export type PreviewRow = {
  /** Position in the payload (0-based) — the server's `reasons[].index` refers to it. */
  index: number;
  /** "Row 3" for CSV (spreadsheet numbering, header = row 1) or "Item 2" for JSON. */
  label: string;
  home: string | null;
  away: string | null;
  homeForm: number | null;
  awayForm: number | null;
  valid: boolean;
  reason: string | null;
  qualifies: boolean;
};

export type Preview = {
  rows: PreviewRow[];
  counts: { valid: number; invalid: number; qualifying: number };
  /** The exact body for POST /api/import (all items; the server validates again and returns reasons). */
  payload: { matches: unknown[]; percentScale?: PercentScale } | null;
  /** Row labels by payload index (for mapping server reasons back to the file). */
  labels: string[];
  notes: string[];
  /** A problem with the whole input (unreadable JSON, missing columns, nothing to import). */
  error: string | null;
};

const EMPTY_COUNTS = { valid: 0, invalid: 0, qualifying: 0 };
const fail = (error: string): Preview => ({
  rows: [],
  counts: EMPTY_COUNTS,
  payload: null,
  labels: [],
  notes: [],
  error,
});

export const slug = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// ---------------------------------------------------------------- CSV -> items

const ALIASES: Record<string, string> = {
  id: "id",
  matchid: "id",
  providermatchid: "id",
  provider: "provider",
  kickoff: "kickoff",
  kickoffat: "kickoff",
  kickofftime: "kickoff",
  datetime: "kickoff",
  date: "kickoff",
  league: "league",
  competition: "league",
  country: "country",
  home: "home",
  hometeam: "home",
  homename: "home",
  away: "away",
  awayteam: "away",
  awayname: "away",
  homeform: "homeForm",
  homeformpct: "homeForm",
  homeformpercent: "homeForm",
  awayform: "awayForm",
  awayformpct: "awayForm",
  awayformpercent: "awayForm",
  homewin: "homeWin",
  draw: "draw",
  awaywin: "awayWin",
  btts: "btts",
  bttsyes: "btts",
  over25: "over25",
  over: "over25",
  predictedhome: "predHome",
  predictedaway: "predAway",
  predictedscore: "predScore",
  formscope: "formScope",
  scope: "formScope",
  sourceurl: "sourceUrl",
  url: "sourceUrl",
};

const REQUIRED = ["home", "away", "homeForm", "awayForm", "kickoff"] as const;
const REQUIRED_LABEL: Record<(typeof REQUIRED)[number], string> = {
  home: "home",
  away: "away",
  homeForm: "homeForm",
  awayForm: "awayForm",
  kickoff: "kickoff",
};
const PERCENT_FIELDS = new Set([
  "homeForm",
  "awayForm",
  "homeWin",
  "draw",
  "awayWin",
  "btts",
  "over25",
]);

/** "80,5%" -> "80.5%" (comma decimals); anything else is left for the shared validator to judge. */
export function commaDecimal(cell: string): string {
  const m = /^(\d+),(\d+)\s*(%?)$/.exec(cell.trim());
  return m ? `${m[1]}.${m[2]}${m[3]}` : cell;
}

function intOrRaw(cell: string): number | string {
  return /^\d+$/.test(cell.trim()) ? Number(cell) : cell;
}

function itemsFromCsv(text: string): { items: unknown[]; labels: string[]; error: string | null } {
  const { rows } = parseCsv(text);
  if (rows.length === 0) return { items: [], labels: [], error: "The file has no rows." };
  const header = rows[0]!.map((h) => ALIASES[h.toLowerCase().replace(/[^a-z0-9]/g, "")] ?? null);
  const missing = REQUIRED.filter((r) => !header.includes(r));
  if (missing.length > 0) {
    return {
      items: [],
      labels: [],
      error: `Missing column${missing.length === 1 ? "" : "s"}: ${missing.map((m) => REQUIRED_LABEL[m]).join(", ")}. Download the sample CSV to see the layout.`,
    };
  }
  if (rows.length < 2)
    return { items: [], labels: [], error: "The file has a header but no matches." };

  const items: unknown[] = [];
  const labels: string[] = [];
  rows.slice(1).forEach((cells, i) => {
    const f: Record<string, string> = {};
    header.forEach((key, col) => {
      const raw = cells[col];
      if (key && raw !== undefined && raw.trim() !== "") {
        f[key] = PERCENT_FIELDS.has(key) ? commaDecimal(raw) : raw.trim();
      }
    });
    let predicted: unknown;
    if (f.predScore) {
      const m = /^(\d+)\s*[-–:]\s*(\d+)$/.exec(f.predScore);
      predicted = m ? { home: Number(m[1]), away: Number(m[2]) } : { home: f.predScore };
    } else if (f.predHome !== undefined || f.predAway !== undefined) {
      predicted = {
        home: f.predHome === undefined ? undefined : intOrRaw(f.predHome),
        away: f.predAway === undefined ? undefined : intOrRaw(f.predAway),
      };
    }
    const probabilities: Record<string, string> = {};
    for (const k of ["homeWin", "draw", "awayWin", "btts", "over25"] as const) {
      if (f[k] !== undefined) probabilities[k] = f[k]!;
    }
    items.push({
      ...(f.provider ? { provider: f.provider } : {}),
      ...(f.id ? { providerMatchId: f.id } : {}),
      ...(f.sourceUrl ? { sourceUrl: f.sourceUrl } : {}),
      kickoffAt: f.kickoff,
      ...(f.league ? { league: f.league } : {}),
      ...(f.country ? { country: f.country } : {}),
      home: { name: f.home, formPct: f.homeForm },
      away: { name: f.away, formPct: f.awayForm },
      ...(f.formScope ? { formScope: f.formScope.toLowerCase() } : {}),
      ...(Object.keys(probabilities).length ? { probabilities } : {}),
      ...(predicted ? { predictedScore: predicted } : {}),
    });
    labels.push(`Row ${i + 2}`);
  });
  return { items, labels, error: null };
}

function itemsFromJson(text: string): {
  items: unknown[];
  percentScale?: PercentScale;
  labels: string[];
  error: string | null;
} {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ""));
  } catch (e) {
    const detail = e instanceof Error ? e.message.replace(/^JSON\.parse: /, "") : "";
    return {
      items: [],
      labels: [],
      error: `That isn't valid JSON${detail ? ` (${detail.slice(0, 120)})` : ""}.`,
    };
  }
  const list = Array.isArray(data) ? data : isObject(data) ? data.matches : undefined;
  if (!Array.isArray(list)) {
    return {
      items: [],
      labels: [],
      error: "Expected a list of matches, or an object with a matches list.",
    };
  }
  const scale =
    isObject(data) && (data.percentScale === "fraction" || data.percentScale === "percent")
      ? (data.percentScale as PercentScale)
      : undefined;
  return {
    items: list,
    percentScale: scale,
    labels: list.map((_, i) => `Item ${i + 1}`),
    error: null,
  };
}

// ------------------------------------------------------- defaults + preview

/** Fills what a hand-made file may leave out: provider, a stable match id and the form scope. */
export function withDefaults(
  item: unknown,
  ctx: ImportContext,
): { item: unknown; scopeAssumed: boolean } {
  if (!isObject(item)) return { item, scopeAssumed: false };
  const out: Record<string, unknown> = { ...item };
  out.provider = typeof out.provider === "string" && out.provider.trim() ? out.provider : "manual";
  const home = isObject(out.home) && typeof out.home.name === "string" ? out.home.name : "";
  const away = isObject(out.away) && typeof out.away.name === "string" ? out.away.name : "";
  if ((out.providerMatchId === undefined || out.providerMatchId === "") && home && away) {
    const day = typeof out.kickoffAt === "string" ? out.kickoffAt.slice(0, 10) : "";
    out.providerMatchId = [/^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "", slug(home), slug(away)]
      .filter(Boolean)
      .join("-");
  }
  let scopeAssumed = false;
  if (out.formScope === undefined || out.formScope === "") {
    out.formScope = ctx.formScope;
    scopeAssumed = true;
  }
  return { item: out, scopeAssumed };
}

/** Validates items with the SAME schema and rules as the server and builds the preview. */
export function previewItems(
  rawItems: unknown[],
  labels: string[],
  ctx: ImportContext,
  percentScale?: PercentScale,
  extraNotes: string[] = [],
): Preview {
  const defaulted = rawItems.map((i) => withDefaults(i, ctx));
  const items = defaulted.map((d) => d.item);
  const notes = [...extraNotes];
  if (defaulted.some((d) => d.scopeAssumed)) {
    notes.push(`No form scope in the data: assuming ${ctx.formScope} form, as set in Settings.`);
  }
  let normalized;
  try {
    normalized = normalizePayload({ matches: items, percentScale });
  } catch (e) {
    if (e instanceof PayloadError) return fail(e.message);
    throw e;
  }

  const byIndex = new Map<number, PreviewRow>();
  const best = (raw: unknown) => {
    const o = isObject(raw) ? raw : {};
    const side = (v: unknown) => (isObject(v) ? v : {});
    const num = (v: unknown) =>
      typeof v === "number"
        ? v
        : typeof v === "string" && /^\d+(\.\d+)?%?$/.test(v)
          ? parseFloat(v)
          : null;
    return {
      home: typeof side(o.home).name === "string" ? (side(o.home).name as string) : null,
      away: typeof side(o.away).name === "string" ? (side(o.away).name as string) : null,
      homeForm: num(side(o.home).formPct),
      awayForm: num(side(o.away).formPct),
    };
  };
  const row = (index: number, patch: Partial<PreviewRow>): PreviewRow => ({
    index,
    label: labels[index] ?? `Item ${index + 1}`,
    ...best(items[index]),
    valid: false,
    reason: null,
    qualifies: false,
    ...patch,
  });

  for (const bad of normalized.invalid)
    byIndex.set(bad.index, row(bad.index, { reason: bad.reason }));
  normalized.valid.forEach((m, i) => {
    const index = normalized.validIndexes[i]!;
    const mismatch = checkFormScope(m, ctx.formScope);
    if (mismatch) {
      byIndex.set(index, row(index, { reason: mismatch }));
      return;
    }
    const verdict = evaluateMatch(
      { homeFormPct: m.home.formPct, awayFormPct: m.away.formPct },
      { high: ctx.high, low: ctx.low },
    );
    byIndex.set(
      index,
      row(index, {
        home: m.home.name,
        away: m.away.name,
        homeForm: m.home.formPct,
        awayForm: m.away.formPct,
        valid: true,
        qualifies: verdict.qualifies,
      }),
    );
  });
  for (let i = 0; i < items.length; i++) {
    if (!byIndex.has(i)) {
      byIndex.set(
        i,
        row(i, { reason: "duplicate of a later row (only the last one is imported)" }),
      );
    }
  }

  const rows = [...byIndex.values()].sort((a, b) => a.index - b.index);
  const valid = rows.filter((r) => r.valid);
  return {
    rows,
    counts: {
      valid: valid.length,
      invalid: rows.length - valid.length,
      qualifying: valid.filter((r) => r.qualifies).length,
    },
    payload: { matches: items, ...(percentScale ? { percentScale } : {}) },
    labels,
    notes,
    error: null,
  };
}

/** Preview for a pasted/uploaded data file: JSON when it starts with [ or {, otherwise CSV. */
export function buildPreview(input: string, ctx: ImportContext): Preview {
  const text = input.replace(/^﻿/, "").trim();
  if (!text) return fail("Paste some data or choose a file first.");
  if (text.startsWith("[") || text.startsWith("{")) {
    const parsed = itemsFromJson(text);
    if (parsed.error) return fail(parsed.error);
    return previewItems(parsed.items, parsed.labels, ctx, parsed.percentScale);
  }
  const parsed = itemsFromCsv(text);
  if (parsed.error) return fail(parsed.error);
  return previewItems(parsed.items, parsed.labels, ctx);
}

// -------------------------------------------------------------- page text

export type TextDraft = {
  home: string;
  away: string;
  homeForm: string;
  awayForm: string;
  league: string;
  /** `yyyy-MM-ddTHH:mm` in the owner's timezone, or "" when the owner still has to pick it. */
  kickoffLocal: string;
  /** True when the pasted text carried an absolute kickoff instant. */
  kickoffFromText: boolean;
  parsed: ParsedPageMatch;
};

export function draftFromParsed(p: ParsedPageMatch, timezone: string): TextDraft {
  return {
    home: p.home ?? "",
    away: p.away ?? "",
    homeForm: p.homeForm === null ? "" : String(p.homeForm),
    awayForm: p.awayForm === null ? "" : String(p.awayForm),
    league: p.league ?? "",
    kickoffLocal: p.kickoffAt
      ? formatInTimeZone(new Date(p.kickoffAt), timezone, "yyyy-MM-dd'T'HH:mm")
      : "",
    kickoffFromText: p.kickoffAt !== null,
    parsed: p,
  };
}

/** Builds an ingest item from an (edited) draft. Missing values stay missing so the validator names them. */
export function itemFromDraft(d: TextDraft, timezone: string, ctx: ImportContext): unknown {
  const p = d.parsed;
  const probabilities: Record<string, number> = {};
  for (const [k, v] of [
    ["homeWin", p.homeWin],
    ["draw", p.draw],
    ["awayWin", p.awayWin],
    ["btts", p.btts],
    ["over25", p.over25],
  ] as const) {
    if (v !== null) probabilities[k] = v;
  }
  let kickoffAt = "";
  if (d.kickoffLocal) {
    const instant = fromZonedTime(d.kickoffLocal, timezone);
    kickoffAt = Number.isNaN(instant.getTime()) ? "" : instant.toISOString();
  }
  return {
    provider: "manual",
    kickoffAt,
    ...(d.league.trim() ? { league: d.league.trim() } : {}),
    home: { name: d.home.trim(), formPct: commaDecimal(d.homeForm.trim()) },
    away: { name: d.away.trim(), formPct: commaDecimal(d.awayForm.trim()) },
    formScope: ctx.formScope,
    ...(Object.keys(probabilities).length ? { probabilities } : {}),
    ...(p.predictedHome !== null && p.predictedAway !== null
      ? { predictedScore: { home: p.predictedHome, away: p.predictedAway } }
      : {}),
  };
}

/** Friendlier wording for the two reasons the owner can fix inline on a pasted match. */
export function explainTextReason(reason: string | null): string | null {
  if (!reason) return null;
  if (reason === "kickoff time is missing") return "Pick the kickoff time.";
  if (/form is missing$/.test(reason)) return "Form % is unavailable. Type it in to import.";
  return reason;
}
