import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import type { RunFinish, RunRecord, RunTrigger } from "./types";

const UNIQUE_VIOLATION = "P2002";

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
    data: { status: "FAILED", finishedAt: now, error: "Run did not finish and was marked failed." },
  });
  return r.count;
}

/** Most recent run that produced usable data (SUCCESS or PARTIAL). */
export async function getLatestUsable(): Promise<RunRecord | null> {
  return getDb().screeningRun.findFirst({
    where: { status: { in: ["SUCCESS", "PARTIAL"] } },
    orderBy: { startedAt: "desc" },
  });
}

export async function list(
  opts: { page?: number; pageSize?: number } = {},
): Promise<{ items: RunRecord[]; total: number }> {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 20, 1), 100);
  const page = Math.max(opts.page ?? 1, 1);
  const db = getDb();
  const [items, total] = await Promise.all([
    db.screeningRun.findMany({
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.screeningRun.count(),
  ]);
  return { items, total };
}

export async function hasRunning(): Promise<boolean> {
  return (await getDb().screeningRun.count({ where: { status: "RUNNING" } })) > 0;
}

export async function getById(id: string): Promise<RunRecord | null> {
  return getDb().screeningRun.findUnique({ where: { id } });
}
