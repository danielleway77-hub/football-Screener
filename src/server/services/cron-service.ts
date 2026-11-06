import { timingSafeEqual } from "node:crypto";
import { localDayRange } from "@/server/domain/window";
import { AppError } from "@/server/errors";
import * as runs from "@/server/repositories/runs";
import { getSettings } from "@/server/services/settings-service";
import { ABANDONED_RUN_MINUTES, cleanup, pullAndProcess } from "@/server/services/run-service";

export const RECENT_RUN_MINUTES = 30;
export const PUSH_MODE_NOTE = "push mode - waiting for the owner's data";

export type Cleaned = { matches: number; attempts: number; rateLimits: number };
export type DailyResult =
  | { skipped: "recent" | "running"; runId: string; status: string }
  | { runId?: string; status: string; error?: string | null; cleaned: Cleaned };

/** Timing-safe check of `Authorization: Bearer <secret>` (padded copies, so lengths never short-circuit). */
export function isValidCronAuth(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  const length = Math.max(given.length, expected.length);
  const a = Buffer.alloc(length);
  const b = Buffer.alloc(length);
  given.copy(a);
  expected.copy(b);
  const same = timingSafeEqual(a, b);
  return same && given.length === expected.length;
}

async function runCleanup(now: Date): Promise<Cleaned> {
  try {
    const c = await cleanup(now);
    return { matches: c.matches, attempts: c.attempts, rateLimits: c.limits };
  } catch (error) {
    console.error("Cleanup failed", { name: (error as Error).name });
    return { matches: 0, attempts: 0, rateLimits: 0 };
  }
}

/** The daily job: (a) expire abandoned runs (b) idempotency (c) pull or note (d) retention (e) summary. */
export async function runDaily(opts: { now?: () => Date } = {}): Promise<DailyResult> {
  const nowFn = opts.now ?? (() => new Date());
  const t0 = nowFn();

  await runs.expireAbandoned(ABANDONED_RUN_MINUTES, t0);

  const recent = await runs.findFinishedSince(
    "CRON",
    new Date(t0.getTime() - RECENT_RUN_MINUTES * 60_000),
  );
  if (recent) return { skipped: "recent", runId: recent.id, status: recent.status };

  let runId: string | undefined;
  let status = "FAILED";
  let error: string | null | undefined;
  try {
    const settings = await getSettings();
    if (settings.accessMode === "official_api") {
      const result = await pullAndProcess({ trigger: "CRON", settings, now: nowFn });
      if (result.alreadyRunning)
        return { skipped: "running", runId: result.runId, status: result.status };
      ({ runId, status, error } = result);
    } else {
      status = "SKIPPED";
      const day = localDayRange(t0, settings.timezone);
      // Non-destructive: only a bookkeeping row, and only when nothing has run yet today.
      if (!(await runs.existsStartedBetween(day.fromUtc, day.toUtc))) {
        const run = await runs.createFinished({
          trigger: "CRON",
          provider: settings.accessMode,
          status: "SKIPPED",
          note: PUSH_MODE_NOTE,
          at: t0,
        });
        runId = run.id;
      }
    }
  } catch (e) {
    error = e instanceof AppError ? e.message : "The daily update failed unexpectedly.";
    console.error("Daily cron failed", { name: e instanceof Error ? e.name : "unknown" });
    status = "FAILED";
    // A started run is already FAILED; otherwise record one so the failure is visible on the Runs page.
    const started = await runs.findStartedSince("CRON", t0).catch(() => null);
    if (started) runId = started.id;
    else {
      runId = await runs
        .createFinished({
          trigger: "CRON",
          provider: "unknown",
          status: "FAILED",
          note: error,
          at: t0,
        })
        .then((r) => r.id)
        .catch(() => undefined);
    }
  }

  const cleaned = await runCleanup(nowFn());
  return { runId, status, ...(error ? { error } : {}), cleaned };
}
