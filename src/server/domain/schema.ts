import { z } from "zod";
import { normalizePercent } from "./percent";
import type { Confidence, PercentScale, Probabilities, RawMatchInput, TeamInput } from "./types";

const MAX_NAME = 80;
const MAX_ID = 64;
const MAX_URL = 500;

type Issue = string;
const isBlank = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** Builds a zod field whose failure message is a finished human sentence. */
function field<T>(
  parse: (value: unknown) => { ok: true; value: T } | { ok: false; reason: Issue },
) {
  return z.unknown().transform((value, ctx) => {
    const result = parse(value);
    if (result.ok) return result.value;
    ctx.issues.push({ code: "custom", message: result.reason, input: value });
    return z.NEVER;
  });
}

const text = (label: string, max: number, required: boolean) =>
  field<string | undefined>((v) => {
    if (isBlank(v))
      return required
        ? { ok: false, reason: `${label} is missing` }
        : { ok: true, value: undefined };
    if (typeof v === "number" && !Number.isSafeInteger(v))
      return { ok: false, reason: `${label} is not text` };
    if (typeof v !== "string" && typeof v !== "number")
      return { ok: false, reason: `${label} is not text` };
    // NUL characters and lone surrogates would make PostgreSQL reject the whole batch: strip them here.
    const s = String(v).replaceAll("\u0000", "").toWellFormed().trim();
    if (s.length > max) return { ok: false, reason: `${label} is longer than ${max} characters` };
    return { ok: true, value: s };
  });

const httpsUrl = (label: string) =>
  field<string | undefined>((v) => {
    if (isBlank(v)) return { ok: true, value: undefined };
    if (typeof v !== "string") return { ok: false, reason: `${label} is not a link` };
    const s = v.trim();
    try {
      if (s.length > MAX_URL || new URL(s).protocol !== "https:") throw new Error("not https");
    } catch {
      return { ok: false, reason: `${label} must be an https link` };
    }
    return { ok: true, value: s };
  });

const percent = (label: string, scale: PercentScale, required: boolean) =>
  field<number | undefined>((v) => {
    if (isBlank(v))
      return required
        ? { ok: false, reason: `${label} is missing` }
        : { ok: true, value: undefined };
    const r = normalizePercent(v, scale);
    return r.ok ? { ok: true, value: r.value } : { ok: false, reason: `${label} ${r.reason}` };
  });

const KICKOFF =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i;
const kickoff = field<Date>((v) => {
  if (isBlank(v)) return { ok: false, reason: "kickoff time is missing" };
  if (typeof v !== "string") return { ok: false, reason: "kickoff time is not text" };
  const s = v.trim();
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) return { ok: false, reason: "kickoff has no timezone" };
  const bad = { ok: false, reason: "kickoff time is not a valid date" } as const;
  const m = KICKOFF.exec(s);
  if (!m) return bad;
  // V8 silently rolls impossible dates over (30 Feb -> 2 Mar, 24:00 -> next day): check the calendar ourselves.
  const [y, mo, d, h, mi, sec] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? "0"].map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > daysInMonth) return bad;
  if (h > 23 || mi > 59 || sec > 59) return bad;
  const date = new Date(s.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return bad;
  return { ok: true, value: date };
});

const lastResults = (label: string) =>
  field<string | undefined>((v) => {
    if (isBlank(v)) return { ok: true, value: undefined };
    const s = Array.isArray(v) ? v.join("") : v;
    if (typeof s !== "string") return { ok: false, reason: `${label} last results are not text` };
    const upper = s.replace(/[\s,]/g, "").toUpperCase();
    if (upper.length > 5 || !/^[WDL]*$/.test(upper)) {
      return { ok: false, reason: `${label} last results must be up to 5 of W, D or L` };
    }
    return { ok: true, value: upper || undefined };
  });

const formScope = field<"league" | "overall">((v) => {
  if (v === "league" || v === "overall") return { ok: true, value: v };
  return {
    ok: false,
    reason: isBlank(v) ? "form scope is missing" : "form scope must be league or overall",
  };
});

const confidence = field<Confidence | undefined>((v) => {
  if (isBlank(v)) return { ok: true, value: undefined };
  const upper = typeof v === "string" ? v.trim().toUpperCase() : "";
  if (upper === "LOW" || upper === "MEDIUM" || upper === "HIGH") return { ok: true, value: upper };
  return { ok: false, reason: "confidence must be LOW, MEDIUM or HIGH" };
});

const goals = (label: string) =>
  field<number>((v) => {
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 20)
      return { ok: true, value: v };
    return { ok: false, reason: `${label} must be a whole number from 0 to 20` };
  });

const predictedScore = field<{ home: number; away: number } | undefined>((v) => {
  if (isBlank(v)) return { ok: true, value: undefined };
  if (typeof v !== "object" || Array.isArray(v))
    return { ok: false, reason: "predicted score is malformed" };
  const o = v as { home?: unknown; away?: unknown };
  const home = goals("predicted home goals").safeParse(o.home);
  if (!home.success) return { ok: false, reason: home.error.issues[0]!.message };
  const away = goals("predicted away goals").safeParse(o.away);
  if (!away.success) return { ok: false, reason: away.error.issues[0]!.message };
  return { ok: true, value: { home: home.data, away: away.data } };
});

function team(label: "home" | "away", scale: PercentScale) {
  return field<TeamInput>((v) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      return { ok: false, reason: `${label} team is missing` };
    }
    const o = v as Record<string, unknown>;
    const name = text(`${label} team name`, MAX_NAME, true).safeParse(o.name);
    if (!name.success) return { ok: false, reason: name.error.issues[0]!.message };
    const form = percent(`${label} form`, scale, true).safeParse(o.formPct);
    if (!form.success) return { ok: false, reason: form.error.issues[0]!.message };
    const logo = httpsUrl(`${label} logo`).safeParse(o.logoUrl);
    if (!logo.success) return { ok: false, reason: logo.error.issues[0]!.message };
    const last = lastResults(label).safeParse(o.lastResults);
    if (!last.success) return { ok: false, reason: last.error.issues[0]!.message };
    return {
      ok: true,
      value: {
        name: name.data as string,
        formPct: form.data as number,
        ...(logo.data ? { logoUrl: logo.data } : {}),
        ...(last.data ? { lastResults: last.data } : {}),
      },
    };
  });
}

function probabilities(scale: PercentScale) {
  return field<Probabilities>((v) => {
    if (isBlank(v)) return { ok: true, value: {} };
    if (typeof v !== "object" || Array.isArray(v))
      return { ok: false, reason: "probabilities are malformed" };
    const o = v as Record<string, unknown>;
    const labels = {
      homeWin: "home win probability",
      draw: "draw probability",
      awayWin: "away win probability",
      btts: "both-teams-to-score probability",
      over25: "over 2.5 probability",
    } as const;
    const out: Probabilities = {};
    for (const key of Object.keys(labels) as (keyof typeof labels)[]) {
      const r = percent(labels[key], scale, false).safeParse(o[key]);
      if (!r.success) return { ok: false, reason: r.error.issues[0]!.message };
      if (r.data !== undefined) out[key] = r.data;
    }
    // Field-mapping guard: a full 1X2 triple must add up to about 100.
    if (out.homeWin !== undefined && out.draw !== undefined && out.awayWin !== undefined) {
      const sum = Math.round((out.homeWin + out.draw + out.awayWin) * 100) / 100;
      if (sum < 98 || sum > 102) {
        return {
          ok: false,
          reason: `win/draw/win probabilities add up to ${sum}, expected about 100`,
        };
      }
    }
    return { ok: true, value: out };
  });
}

export function makeRawMatchSchema(scale: PercentScale) {
  return z.object({
    provider: text("provider", MAX_ID, true),
    providerMatchId: text("match id", MAX_ID, true),
    sourceUrl: httpsUrl("source link").optional(),
    kickoffAt: kickoff,
    league: text("league", MAX_NAME, false).optional(),
    country: text("country", MAX_NAME, false).optional(),
    home: team("home", scale),
    away: team("away", scale),
    formScope,
    probabilities: probabilities(scale).optional(),
    predictedScore: predictedScore.optional(),
    confidence: confidence.optional(),
  });
}

export const rawMatchInputSchema = makeRawMatchSchema("percent");

export const ingestPayloadSchema = z.object(
  {
    matches: z
      .array(z.unknown(), { error: "matches must be a list" })
      .min(1, "matches must contain at least one match")
      .max(500, "matches must contain at most 500 matches"),
    percentScale: z.enum(["percent", "fraction"]).optional(),
  },
  { error: "payload must be an object with a matches list" },
);

export type ParseResult = { ok: true; value: RawMatchInput } | { ok: false; reason: string };

/** Validates ONE item and returns either the clean value or the first human-readable problem. */
export function parseRawMatch(raw: unknown, scale: PercentScale = "percent"): ParseResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: "item is not an object" };
  }
  const parsed = makeRawMatchSchema(scale).safeParse(raw);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const value: RawMatchInput = {
    provider: d.provider as string,
    providerMatchId: d.providerMatchId as string,
    kickoffAt: d.kickoffAt,
    home: d.home,
    away: d.away,
    formScope: d.formScope,
    probabilities: d.probabilities ?? {},
    ...(d.sourceUrl ? { sourceUrl: d.sourceUrl } : {}),
    ...(d.league ? { league: d.league } : {}),
    ...(d.country ? { country: d.country } : {}),
    ...(d.predictedScore ? { predictedScore: d.predictedScore } : {}),
    ...(d.confidence ? { confidence: d.confidence } : {}),
  };
  return { ok: true, value };
}
