import { normalizePayload, PayloadError } from "@/server/domain/normalize";
import { checkFormScope, evaluateMatch } from "@/server/domain/screening";
import type { InvalidItem, RawMatchInput } from "@/server/domain/types";
import { computeWindow } from "@/server/domain/window";
import { AppError } from "@/server/errors";
import { getProvider } from "@/server/providers";
import * as loginAttempts from "@/server/repositories/login-attempts";
import * as matches from "@/server/repositories/matches";
import * as rateLimits from "@/server/repositories/rate-limits";
import * as runs from "@/server/repositories/runs";
import type {
  AccessMode,
  MatchInput,
  RunRecord,
  RunStatus,
  RunTrigger,
  SettingRecord,
} from "@/server/repositories/types";

export const ABANDONED_RUN_MINUTES = 10;
export const DETAILS_CAP = 200;
const DAY = 86_400_000;

export type RunSummary = {
  runId: string;
  status: RunStatus;
  scanned: number;
  qualified: number;
  failed: number;
  error?: string | null;
  /** True when another run was already in progress: this call did nothing and returned that run. */
  alreadyRunning?: boolean;
};

type Clock = { now?: () => Date };

type Loaded = {
  valid: RawMatchInput[];
  validIndexes: number[];
  invalid: InvalidItem[];
  duplicates: number;
  /** True for a pull provider that returned nothing (a valid, empty answer). */
  pulledEmpty?: boolean;
};

/** (a) recover runs stuck in RUNNING, (b) take the single RUNNING slot or return the one holding it. */
export async function startRun(
  input: { trigger: RunTrigger; provider: AccessMode; windowFrom?: Date; windowTo?: Date },
  clock: Clock = {},
): Promise<{ runId: string; alreadyRunning: boolean }> {
  const now = (clock.now ?? (() => new Date()))();
  await runs.expireAbandoned(ABANDONED_RUN_MINUTES, now);
  const { run, created } = await runs.createRunning({ ...input, startedAt: now });
  return { runId: run.id, alreadyRunning: !created };
}

/** Writing the final status must never leave the run RUNNING: log and rethrow if it fails. */
async function finishRun(runId: string, result: Parameters<typeof runs.finish>[1]): Promise<void> {
  try {
    await runs.finish(runId, result);
  } catch (error) {
    console.error("Could not write the run result", { runId, name: (error as Error).name });
    throw error;
  }
}

function screen(loaded: Loaded, settings: SettingRecord, now: Date) {
  const invalid = [...loaded.invalid];
  const rows: { input: MatchInput; qualifiedAtRun: boolean }[] = [];
  loaded.valid.forEach((m, i) => {
    const mismatch = checkFormScope(m, settings.formScope);
    if (mismatch) {
      invalid.push({ index: loaded.validIndexes[i] ?? i, id: m.providerMatchId, reason: mismatch });
      return;
    }
    const result = evaluateMatch(
      { homeFormPct: m.home.formPct, awayFormPct: m.away.formPct },
      { high: settings.highThreshold, low: settings.lowThreshold },
    );
    const p = m.probabilities;
    rows.push({
      qualifiedAtRun: result.qualifies,
      input: {
        provider: m.provider,
        providerMatchId: m.providerMatchId,
        sourceUrl: m.sourceUrl ?? null,
        kickoffAt: m.kickoffAt,
        league: m.league ?? null,
        country: m.country ?? null,
        homeName: m.home.name,
        awayName: m.away.name,
        homeLogoUrl: m.home.logoUrl ?? null,
        awayLogoUrl: m.away.logoUrl ?? null,
        homeFormPct: m.home.formPct,
        awayFormPct: m.away.formPct,
        formScope: m.formScope,
        homeLastResults: m.home.lastResults ?? null,
        awayLastResults: m.away.lastResults ?? null,
        // Missing probabilities are stored as null, never as 0.
        pHomeWin: p.homeWin ?? null,
        pDraw: p.draw ?? null,
        pAwayWin: p.awayWin ?? null,
        pBtts: p.btts ?? null,
        pOver25: p.over25 ?? null,
        predHomeGoals: m.predictedScore?.home ?? null,
        predAwayGoals: m.predictedScore?.away ?? null,
        confidence: m.confidence ?? null,
        qualifies: result.qualifies,
        strongSide: result.strongSide,
        formGap: result.formGap,
        lastRunId: null,
        // Always the SERVER's clock: client clocks are not trusted.
        fetchedAt: now,
      },
    });
  });
  return { invalid, rows };
}

/** The pipeline every trigger shares: start → load → screen → store (one transaction) → finish. */
async function executeRun(opts: {
  trigger: RunTrigger;
  provider: AccessMode;
  settings: SettingRecord;
  clock: Clock;
  windowFrom?: Date;
  windowTo?: Date;
  load: () => Promise<Loaded>;
}): Promise<RunSummary> {
  const nowFn = opts.clock.now ?? (() => new Date());
  const started = await startRun(
    {
      trigger: opts.trigger,
      provider: opts.provider,
      windowFrom: opts.windowFrom,
      windowTo: opts.windowTo,
    },
    opts.clock,
  );
  if (started.alreadyRunning) {
    return {
      runId: started.runId,
      status: "RUNNING",
      scanned: 0,
      qualified: 0,
      failed: 0,
      alreadyRunning: true,
    };
  }
  const runId = started.runId;

  try {
    const loaded = await opts.load();
    const { invalid, rows } = screen(loaded, opts.settings, nowFn());
    const scanned = loaded.valid.length + loaded.invalid.length + loaded.duplicates;
    const qualified = rows.filter((r) => r.input.qualifies).length;
    const details = invalid.slice(0, DETAILS_CAP);

    if (rows.length > 0) await matches.storeBatch(rows, runId);

    let status: RunStatus;
    let error: string | null = null;
    if (loaded.pulledEmpty) {
      status = "SUCCESS";
      error = "provider returned no fixtures";
    } else if (rows.length === 0) {
      status = "FAILED";
      error = "None of the matches in this update could be used.";
    } else if (invalid.length > 0) {
      status = "PARTIAL";
      error = `${invalid.length} of ${scanned} matches were skipped.`;
    } else {
      status = "SUCCESS";
    }

    await finishRun(runId, {
      status: status as Exclude<RunStatus, "RUNNING">,
      finishedAt: nowFn(),
      scanned,
      qualified,
      failedCount: invalid.length,
      error,
      details: details.length ? details : undefined,
    });
    return { runId, status, scanned, qualified, failed: invalid.length, error };
  } catch (error) {
    // Anything unexpected: the transaction already rolled back, earlier data is untouched.
    const known = error instanceof AppError;
    const cancelled = error instanceof Error && error.message === matches.RUN_NOT_RUNNING;
    console.error("Run failed", { runId, code: known ? error.code : (error as Error).name });
    const message = known
      ? error.message
      : cancelled
        ? "This update took too long and was cancelled. Try again."
        : "Something went wrong while saving. Try again.";
    await finishRun(runId, { status: "FAILED", finishedAt: nowFn(), error: message });
    if (known) throw error;
    return { runId, status: "FAILED", scanned: 0, qualified: 0, failed: 0, error: message };
  }
}

/**
 * Push path (ingest/import): validate the payload, screen it with the current settings and store it.
 * `payload` is `{matches, percentScale?}` (a bare array is accepted too). An unusable payload throws
 * VALIDATION_FAILED and creates no run.
 */
export async function processBatch(
  opts: {
    trigger: RunTrigger;
    provider: AccessMode;
    payload: unknown;
    settings: SettingRecord;
  } & Clock,
): Promise<RunSummary> {
  const payload = Array.isArray(opts.payload) ? { matches: opts.payload } : opts.payload;
  let normalized;
  try {
    normalized = normalizePayload(payload);
  } catch (error) {
    if (error instanceof PayloadError) throw new AppError("VALIDATION_FAILED", error.message);
    throw error;
  }
  return executeRun({
    trigger: opts.trigger,
    provider: opts.provider,
    settings: opts.settings,
    clock: { now: opts.now },
    load: async () => normalized,
  });
}

/** Pull path (cron / Run now): only for providers that can fetch (official API). */
export async function pullAndProcess(
  opts: {
    trigger: RunTrigger;
    settings: SettingRecord;
    signal?: AbortSignal;
  } & Clock,
): Promise<RunSummary> {
  const provider = getProvider(opts.settings.accessMode);
  if (!provider.canPull || !provider.fetchWindow) {
    throw new AppError("MODE_NOT_SUPPORTED", "Use Update data / Import for your access mode.");
  }
  const now = (opts.now ?? (() => new Date()))();
  const window = computeWindow(now, opts.settings.timezone, opts.settings.windowDays as 1 | 2);
  const fetchWindow = provider.fetchWindow.bind(provider);
  return executeRun({
    trigger: opts.trigger,
    provider: provider.key,
    settings: opts.settings,
    clock: { now: opts.now },
    windowFrom: window.fromUtc,
    windowTo: window.toUtc,
    load: async () => {
      const items = await fetchWindow(
        { from: window.fromUtc, to: window.toUtc },
        { settings: opts.settings, signal: opts.signal ?? new AbortController().signal },
      );
      if (items.length === 0) {
        return { valid: [], validIndexes: [], invalid: [], duplicates: 0, pulledEmpty: true };
      }
      // Pulled items go through the SAME validation as pushed ones (dedupe, kickoff, ranges).
      const asJson = items.map((m) => ({
        ...m,
        kickoffAt:
          m.kickoffAt instanceof Date && !Number.isNaN(m.kickoffAt.getTime())
            ? m.kickoffAt.toISOString()
            : "invalid",
      }));
      return normalizePayload({ matches: asJson });
    },
  });
}

/** Re-evaluates every stored match with the current thresholds, atomically (all or nothing). */
export async function rescreenAll(
  settings: SettingRecord,
): Promise<{ changed: number; qualifying: number }> {
  // Refuse while an update is running: it would be screened with the old thresholds.
  if (await runs.hasRunning()) {
    throw new AppError("RUN_IN_PROGRESS", "An update is running. Try again in a minute.");
  }
  const thresholds = { high: settings.highThreshold, low: settings.lowThreshold };
  let qualifying = 0;
  const { updated } = await matches.rescreen((all) => {
    const updates: matches.ScreeningUpdate[] = [];
    for (const m of all) {
      const r = evaluateMatch(
        { homeFormPct: m.homeFormPct, awayFormPct: m.awayFormPct },
        thresholds,
      );
      if (r.qualifies) qualifying += 1;
      if (r.qualifies !== m.qualifies || r.strongSide !== m.strongSide || r.formGap !== m.formGap) {
        updates.push({
          id: m.id,
          qualifies: r.qualifies,
          strongSide: r.strongSide,
          formGap: r.formGap,
        });
      }
    }
    return updates;
  });
  return { changed: updated, qualifying };
}

/** Retention: matches 90 days after kickoff, login attempts 30 days, rate-limit counters 2 days. */
export async function cleanup(
  now: Date,
): Promise<{ matches: number; attempts: number; limits: number }> {
  return {
    matches: await matches.deleteOlderThan(new Date(now.getTime() - 90 * DAY)),
    attempts: await loginAttempts.purge(new Date(now.getTime() - 30 * DAY)),
    limits: await rateLimits.purgeOlderThan(new Date(now.getTime() - 2 * DAY)),
  };
}

export const RUNS_PAGE_SIZE = 20;

/**
 * One page of run history for the Runs page. Abandoned RUNNING rows are expired first (on read), SKIPPED
 * runs are hidden unless asked for, and the page is clamped to the existing range (size is capped at 20).
 */
export async function listRunsPage(
  opts: { page: number; status?: RunStatus | null; showSkipped?: boolean },
  now: Date,
): Promise<{ items: RunRecord[]; total: number; page: number; totalPages: number }> {
  await runs.expireAbandoned(ABANDONED_RUN_MINUTES, now);
  const base = {
    pageSize: RUNS_PAGE_SIZE,
    excludeSkipped: !opts.showSkipped,
    ...(opts.status ? { status: opts.status } : {}),
  };
  let page = Math.max(opts.page, 1);
  let result = await runs.list({ ...base, page });
  const totalPages = Math.max(Math.ceil(result.total / RUNS_PAGE_SIZE), 1);
  if (page > totalPages) {
    page = totalPages;
    result = await runs.list({ ...base, page });
  }
  return { items: result.items, total: result.total, page, totalPages };
}
