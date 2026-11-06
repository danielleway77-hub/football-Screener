import { getDb } from "@/lib/db";
import type { MatchInput, MatchRecord } from "./types";

const CHUNK = 100;

/**
 * Insert or update matches by (provider, providerMatchId), in one transaction, chunked at ≤ 100.
 * Idempotent: the same payload twice leaves one row per match. `firstRunId` is set only on insert;
 * `lastRunId` is `runId` (the run writing them).
 */
export async function upsertMany(
  inputs: MatchInput[],
  runId: string | null,
): Promise<MatchRecord[]> {
  const out: MatchRecord[] = [];
  await getDb().$transaction(
    async (tx) => {
      for (let i = 0; i < inputs.length; i += CHUNK) {
        for (const m of inputs.slice(i, i + CHUNK)) {
          const { provider, providerMatchId, ...rest } = m;
          out.push(
            await tx.match.upsert({
              where: { provider_providerMatchId: { provider, providerMatchId } },
              update: { ...rest, lastRunId: runId ?? rest.lastRunId },
              create: { provider, providerMatchId, ...rest, firstRunId: runId, lastRunId: runId },
            }),
          );
        }
      }
    },
    { timeout: 30_000 },
  );
  return out;
}

export type QualifyingQuery = {
  /** Inclusive lower / exclusive upper bound of kickoffAt (UTC instants from the domain window helper). */
  from: Date;
  to: Date;
  league?: string;
  sort?: "kickoff" | "gap";
  limit?: number;
};

export async function findQualifyingUpcoming(q: QualifyingQuery): Promise<MatchRecord[]> {
  return getDb().match.findMany({
    where: {
      qualifies: true,
      kickoffAt: { gte: q.from, lt: q.to },
      ...(q.league ? { league: q.league } : {}),
    },
    orderBy:
      q.sort === "gap"
        ? [{ formGap: "desc" }, { kickoffAt: "asc" }]
        : [{ kickoffAt: "asc" }, { formGap: "desc" }],
    take: Math.min(Math.max(q.limit ?? 200, 1), 200),
  });
}

export async function findById(id: string): Promise<MatchRecord | null> {
  return getDb().match.findUnique({ where: { id } });
}

/** Previous/next qualifying match by kickoff (detail-page navigation). */
export async function findNeighbors(
  id: string,
): Promise<{ previous: MatchRecord | null; next: MatchRecord | null }> {
  const db = getDb();
  const current = await db.match.findUnique({ where: { id } });
  if (!current) return { previous: null, next: null };
  const [previous, next] = await Promise.all([
    db.match.findFirst({
      where: { qualifies: true, kickoffAt: { lt: current.kickoffAt } },
      orderBy: { kickoffAt: "desc" },
    }),
    db.match.findFirst({
      where: { qualifies: true, kickoffAt: { gt: current.kickoffAt } },
      orderBy: { kickoffAt: "asc" },
    }),
  ]);
  return { previous, next };
}

export async function countByRun(runId: string): Promise<number> {
  return getDb().runMatch.count({ where: { runId } });
}

/** Retention: delete matches whose kickoff is before `date` (RunMatch rows cascade). Returns the count. */
export async function deleteOlderThan(date: Date): Promise<number> {
  const r = await getDb().match.deleteMany({ where: { kickoffAt: { lt: date } } });
  return r.count;
}

/** Links matches to a run with their qualification at that time (idempotent). */
export async function linkToRun(
  runId: string,
  links: { matchId: string; qualifiedAtRun: boolean }[],
): Promise<void> {
  if (links.length === 0) return;
  await getDb().runMatch.createMany({
    data: links.map((l) => ({ runId, ...l })),
    skipDuplicates: true,
  });
}

export async function listAll(): Promise<MatchRecord[]> {
  return getDb().match.findMany({ orderBy: { kickoffAt: "asc" } });
}
