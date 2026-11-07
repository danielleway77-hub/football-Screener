import { Prisma } from "@/generated/prisma/client";
import { readQuery } from "@/lib/db-retry";
import { getDb } from "@/lib/db";
import type { RunFinish, RunRecord, RunStatus, RunTrigger } from "./types";

const UNIQUE_VIOLATION = "P2002";

/** Error text written by `expireAbandoned`; the Runs page shows such runs as "timed out". */
export const ABANDONED_ERROR = "Run did not finish and was marked failed.";

/**
 * Start a run. The partial unique index `one_running_run` allows only one RUNNING row; if another run
 * is already RUNNING (even from a parallel request) this returns THAT run with `created: false`.
 */
export async function createRunning(input: {
  trigger: RunTrigger;
  provider: string;
  windowFrom?: Date | null;
  windowTo?: Date | null;
  /** Injected clock (defaults to the database clock). */
  startedAt?: Date;
}): Promise<{ run: RunRecord; created: boolean }> {
  const db = getDb();
  // The RUNNING run may finish between our failed insert and the lookup; retry instead of surfacing P2002.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const run = await db.screeningRun.create({
        data: {
          trigger: input.trigger,
          provider: input.provider,
          status: "RUNNING",
          ...(input.startedAt ? { startedAt: input.startedAt } : {}),
          windowFrom: input.windowFrom ?? null,
          windowTo: input.windowTo ?? null,
        },
      });
      return { run, created: true };
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === UNIQUE_VIOLATION))
        throw e;
      const existing = await db.screeningRun.findFirst({ where: { status: "RUNNING" } });
      if (existing) return { run: existing, created: false };
    }
  }
  throw new Error("Could not start or find a running run");
}

/**
 * Finishes a run that is still RUNNING. Returns null (and changes nothing) if it was already finished or
 * expired, so a slow run can never overwrite a FAILED/expired status.
 */
export async function finish(id: string, result: RunFinish): Promise<RunRecord | null> {
  const db = getDb();
  const r = await db.screeningRun.updateMany({
    where: { id, status: "RUNNING" },
    data: {
      status: result.status,
      finishedAt: result.finishedAt,
      ...(result.scanned !== undefined ? { scanned: result.scanned } : {}),
      ...(result.qualified !== undefined ? { qualified: result.qualified } : {}),
      ...(result.failedCount !== undefined ? { failedCount: result.failedCount } : {}),
      ...(result.error !== undefined ? { error: result.error } : {}),
      ...(result.details !== undefined ? { details: result.details as Prisma.InputJsonValue } : {}),
    },
  });
  return r.count === 1 ? db.screeningRun.findUnique({ where: { id } }) : null;
}

/** Marks RUNNING rows older than `olderThanMinutes` (relative to `now`) as FAILED. Returns how many. */
export async function expireAbandoned(olderThanMinutes: number, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - olderThanMinutes * 60_000);
  const r = await getDb().screeningRun.updateMany({
    where: { status: "RUNNING", startedAt: { lt: cutoff } },
    data: { status: "FAILED", finishedAt: now, error: ABANDONED_ERROR },
  });
  return r.count;
}

/**
 * Retention: deletes FINISHED runs that started before `date` (their RunMatch rows cascade). RUNNING rows are
 * never touched. Idempotent: a second call with the same date deletes nothing. Returns the count.
 */
export async function deleteFinishedOlderThan(date: Date): Promise<number> {
  const r = await getDb().screeningRun.deleteMany({
    where: { startedAt: { lt: date }, status: { not: "RUNNING" } },
  });
  return r.count;
}

/** Most recent run that produced usable data (SUCCESS or PARTIAL). */
export async function getLatestUsable(): Promise<RunRecord | null> {
  return readQuery(() =>
    getDb().screeningRun.findFirst({
      where: { status: { in: ["SUCCESS", "PARTIAL"] } },
      orderBy: { startedAt: "desc" },
    }),
  );
}

export async function list(
  opts: {
    page?: number;
    pageSize?: number;
    excludeSkipped?: boolean;
    /** Only runs with this status (wins over `excludeSkipped`). */
    status?: RunStatus;
  } = {},
): Promise<{ items: RunRecord[]; total: number }> {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 20, 1), 100);
  const page = Math.max(opts.page ?? 1, 1);
  const db = getDb();
  // SKIPPED runs (push mode, nothing to do) are bookkeeping: the Runs page hides them unless asked.
  const where = opts.status
    ? { status: opts.status }
    : opts.excludeSkipped
      ? { status: { not: "SKIPPED" as const } }
      : {};
  const [items, total] = await Promise.all([
    db.screeningRun.findMany({
      where,
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.screeningRun.count({ where }),
  ]);
  return { items, total };
}

export async function hasRunning(): Promise<boolean> {
  return (await readQuery(() => getDb().screeningRun.count({ where: { status: "RUNNING" } }))) > 0;
}

export async function getById(id: string): Promise<RunRecord | null> {
  return readQuery(() => getDb().screeningRun.findUnique({ where: { id } }));
}

/** A run with this trigger that finished at or after `since` (newest first), or null. */
export async function findFinishedSince(
  trigger: RunTrigger,
  since: Date,
): Promise<RunRecord | null> {
  return getDb().screeningRun.findFirst({
    // FAILED runs never count as "done": a retry after a failure must be able to run.
    where: {
      trigger,
      finishedAt: { gte: since },
      status: { in: ["SUCCESS", "PARTIAL", "SKIPPED"] },
    },
    orderBy: { finishedAt: "desc" },
  });
}

/** True when any run started inside [from, to). */
export async function existsStartedBetween(from: Date, to: Date): Promise<boolean> {
  return (
    (await readQuery(() =>
      getDb().screeningRun.count({ where: { startedAt: { gte: from, lt: to } } }),
    )) > 0
  );
}

/** Newest run with this trigger that started at or after `since`, or null. */
export async function findStartedSince(
  trigger: RunTrigger,
  since: Date,
): Promise<RunRecord | null> {
  return getDb().screeningRun.findFirst({
    where: { trigger, status: "FAILED", startedAt: { gte: since } },
    orderBy: { startedAt: "desc" },
  });
}

/** Records a run that ended immediately (SKIPPED, or a FAILED run for an error before any run started). */
export async function createFinished(input: {
  trigger: RunTrigger;
  provider: string;
  status: "SKIPPED" | "FAILED";
  note: string;
  at: Date;
}): Promise<RunRecord> {
  return getDb().screeningRun.create({
    data: {
      trigger: input.trigger,
      provider: input.provider,
      status: input.status,
      startedAt: input.at,
      finishedAt: input.at,
      error: input.note,
    },
  });
}

/** Most recent run started by the helper (INGEST) — for the Import page status line. */
export async function getLatestByTrigger(trigger: RunTrigger): Promise<RunRecord | null> {
  return readQuery(() =>
    getDb().screeningRun.findFirst({ where: { trigger }, orderBy: { startedAt: "desc" } }),
  );
}
