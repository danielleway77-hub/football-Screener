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
    { maxWait: 30_000, timeout: 60_000 },
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
      ...(q.league
        ? {
            OR: [
              { league: { contains: q.league, mode: "insensitive" as const } },
              { country: { contains: q.league, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy:
      q.sort === "gap"
        ? [{ formGap: "desc" }, { kickoffAt: "asc" }, { id: "asc" }]
        : [{ kickoffAt: "asc" }, { formGap: "desc" }, { id: "asc" }],
    take: Math.min(Math.max(q.limit ?? 200, 1), 200),
  });
}

/** How many qualifying matches kick off in [from, to). One cheap COUNT per dashboard tab. */
export async function countQualifying(from: Date, to: Date): Promise<number> {
  return getDb().match.count({ where: { qualifies: true, kickoffAt: { gte: from, lt: to } } });
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
      where: {
        qualifies: true,
        OR: [
          { kickoffAt: { lt: current.kickoffAt } },
          { kickoffAt: current.kickoffAt, id: { lt: current.id } },
        ],
      },
      orderBy: [{ kickoffAt: "desc" }, { id: "desc" }],
    }),
    db.match.findFirst({
      where: {
        qualifies: true,
        OR: [
          { kickoffAt: { gt: current.kickoffAt } },
          { kickoffAt: current.kickoffAt, id: { gt: current.id } },
        ],
      },
      orderBy: [{ kickoffAt: "asc" }, { id: "asc" }],
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

export const RUN_NOT_RUNNING = "RUN_NOT_RUNNING";

/** One screened match ready to store, plus how it screened in this run. */
export type StoreRow = { input: MatchInput; qualifiedAtRun: boolean };

const iso = (d: Date) => d.toISOString();
const col = <T>(v: T | null | undefined) => (v === undefined ? null : v);

/**
 * Stores a screened batch ATOMICALLY: upserts Match rows (keeps firstRunId/createdAt, sets lastRunId) and
 * links them to the run (RunMatch.qualifiedAtRun), in ONE transaction, ≤ 100 rows per SQL statement, one
 * round trip per chunk (jsonb_to_recordset + CTE) so 500 matches stay fast on a remote database.
 * If any statement fails the whole batch rolls back and earlier data is untouched.
 */
export async function storeBatch(rows: StoreRow[], runId: string): Promise<number> {
  // The same match twice in one statement would make ON CONFLICT fail: last one wins.
  const unique = new Map<string, StoreRow>();
  for (const r of rows) unique.set(`${r.input.provider}\u0000${r.input.providerMatchId}`, r);
  const list = [...unique.values()];

  await getDb().$transaction(
    async (tx) => {
      // The run must still be RUNNING (it may have been expired as abandoned): lock its row, or roll back.
      const live = await tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT "id" FROM "ScreeningRun" WHERE "id" = $1 AND "status" = 'RUNNING' FOR UPDATE`,
        runId,
      );
      if (live.length === 0) throw new Error(RUN_NOT_RUNNING);
      for (let i = 0; i < list.length; i += CHUNK) {
        const payload = list.slice(i, i + CHUNK).map(({ input: m, qualifiedAtRun }) => ({
          id: crypto.randomUUID(),
          provider: m.provider,
          providerMatchId: m.providerMatchId,
          sourceUrl: col(m.sourceUrl),
          kickoffAt: iso(m.kickoffAt),
          league: col(m.league),
          country: col(m.country),
          homeName: m.homeName,
          awayName: m.awayName,
          homeLogoUrl: col(m.homeLogoUrl),
          awayLogoUrl: col(m.awayLogoUrl),
          homeFormPct: m.homeFormPct,
          awayFormPct: m.awayFormPct,
          formScope: m.formScope,
          homeLastResults: col(m.homeLastResults),
          awayLastResults: col(m.awayLastResults),
          pHomeWin: col(m.pHomeWin),
          pDraw: col(m.pDraw),
          pAwayWin: col(m.pAwayWin),
          pBtts: col(m.pBtts),
          pOver25: col(m.pOver25),
          predHomeGoals: col(m.predHomeGoals),
          predAwayGoals: col(m.predAwayGoals),
          confidence: col(m.confidence),
          qualifies: m.qualifies,
          strongSide: col(m.strongSide),
          formGap: m.formGap,
          fetchedAt: iso(m.fetchedAt),
          qualifiedAtRun,
        }));
        await tx.$executeRawUnsafe(UPSERT_SQL, JSON.stringify(payload), runId);
      }
    },
    { maxWait: 30_000, timeout: 60_000 },
  );
  return list.length;
}

const UPSERT_SQL = `
WITH r AS (
  SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
    "id" text, "provider" text, "providerMatchId" text, "sourceUrl" text, "kickoffAt" timestamp,
    "league" text, "country" text, "homeName" text, "awayName" text, "homeLogoUrl" text, "awayLogoUrl" text,
    "homeFormPct" float8, "awayFormPct" float8, "formScope" text, "homeLastResults" text, "awayLastResults" text,
    "pHomeWin" float8, "pDraw" float8, "pAwayWin" float8, "pBtts" float8, "pOver25" float8,
    "predHomeGoals" int, "predAwayGoals" int, "confidence" text, "qualifies" boolean, "strongSide" text,
    "formGap" float8, "fetchedAt" timestamp, "qualifiedAtRun" boolean)
),
up AS (
  INSERT INTO "Match" ("id","provider","providerMatchId","sourceUrl","kickoffAt","league","country","homeName",
    "awayName","homeLogoUrl","awayLogoUrl","homeFormPct","awayFormPct","formScope","homeLastResults","awayLastResults",
    "pHomeWin","pDraw","pAwayWin","pBtts","pOver25","predHomeGoals","predAwayGoals","confidence","qualifies",
    "strongSide","formGap","firstRunId","lastRunId","fetchedAt","createdAt","updatedAt")
  SELECT r."id", r."provider", r."providerMatchId", r."sourceUrl", r."kickoffAt", r."league", r."country", r."homeName",
    r."awayName", r."homeLogoUrl", r."awayLogoUrl", r."homeFormPct", r."awayFormPct", r."formScope"::"FormScope",
    r."homeLastResults", r."awayLastResults", r."pHomeWin", r."pDraw", r."pAwayWin", r."pBtts", r."pOver25",
    r."predHomeGoals", r."predAwayGoals", r."confidence"::"Confidence", r."qualifies", r."strongSide"::"Side",
    r."formGap", $2::text, $2::text, r."fetchedAt", now(), now()
  FROM r
  ON CONFLICT ("provider","providerMatchId") DO UPDATE SET
    "sourceUrl" = EXCLUDED."sourceUrl", "kickoffAt" = EXCLUDED."kickoffAt", "league" = EXCLUDED."league",
    "country" = EXCLUDED."country", "homeName" = EXCLUDED."homeName", "awayName" = EXCLUDED."awayName",
    "homeLogoUrl" = EXCLUDED."homeLogoUrl", "awayLogoUrl" = EXCLUDED."awayLogoUrl",
    "homeFormPct" = EXCLUDED."homeFormPct", "awayFormPct" = EXCLUDED."awayFormPct", "formScope" = EXCLUDED."formScope",
    "homeLastResults" = EXCLUDED."homeLastResults", "awayLastResults" = EXCLUDED."awayLastResults",
    "pHomeWin" = EXCLUDED."pHomeWin", "pDraw" = EXCLUDED."pDraw", "pAwayWin" = EXCLUDED."pAwayWin",
    "pBtts" = EXCLUDED."pBtts", "pOver25" = EXCLUDED."pOver25", "predHomeGoals" = EXCLUDED."predHomeGoals",
    "predAwayGoals" = EXCLUDED."predAwayGoals", "confidence" = EXCLUDED."confidence", "qualifies" = EXCLUDED."qualifies",
    "strongSide" = EXCLUDED."strongSide", "formGap" = EXCLUDED."formGap", "lastRunId" = EXCLUDED."lastRunId",
    "fetchedAt" = EXCLUDED."fetchedAt", "updatedAt" = now()
  RETURNING "id", "provider", "providerMatchId"
)
INSERT INTO "RunMatch" ("runId","matchId","qualifiedAtRun")
SELECT $2::text, up."id", r."qualifiedAtRun"
FROM up JOIN r ON r."provider" = up."provider" AND r."providerMatchId" = up."providerMatchId"
ON CONFLICT ("runId","matchId") DO UPDATE SET "qualifiedAtRun" = EXCLUDED."qualifiedAtRun"
`;

export type ScreeningUpdate = {
  id: string;
  qualifies: boolean;
  strongSide: "HOME" | "AWAY" | null;
  formGap: number;
};

/** Applies new screening results to many matches in ONE transaction (rescreen is all-or-nothing). */
export async function applyScreening(updates: ScreeningUpdate[]): Promise<void> {
  if (updates.length === 0) return;
  await getDb().$transaction(
    async (tx) => {
      for (let i = 0; i < updates.length; i += CHUNK) {
        await tx.$executeRawUnsafe(
          `UPDATE "Match" m SET "qualifies" = r."qualifies", "strongSide" = r."strongSide"::"Side",
             "formGap" = r."formGap", "updatedAt" = now()
           FROM jsonb_to_recordset($1::jsonb) AS r("id" text, "qualifies" boolean, "strongSide" text, "formGap" float8)
           WHERE m."id" = r."id"`,
          JSON.stringify(updates.slice(i, i + CHUNK)),
        );
      }
    },
    { maxWait: 30_000, timeout: 60_000 },
  );
}

/**
 * Reads every match, lets `compute` decide the changes, and applies them in ONE transaction that holds a
 * table lock against concurrent writers (no run can slip in between the read and the write).
 */
export async function rescreen(
  compute: (all: MatchRecord[]) => ScreeningUpdate[],
): Promise<{ total: number; updated: number }> {
  return getDb().$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`LOCK TABLE "Match" IN SHARE ROW EXCLUSIVE MODE`);
      const all = await tx.match.findMany();
      const updates = compute(all);
      for (let i = 0; i < updates.length; i += CHUNK) {
        await tx.$executeRawUnsafe(
          `UPDATE "Match" m SET "qualifies" = r."qualifies", "strongSide" = r."strongSide"::"Side",
             "formGap" = r."formGap", "updatedAt" = now()
           FROM jsonb_to_recordset($1::jsonb) AS r("id" text, "qualifies" boolean, "strongSide" text, "formGap" float8)
           WHERE m."id" = r."id"`,
          JSON.stringify(updates.slice(i, i + CHUNK)),
        );
      }
      return { total: all.length, updated: updates.length };
    },
    { maxWait: 30_000, timeout: 60_000 },
  );
}

export async function listAll(): Promise<MatchRecord[]> {
  return getDb().match.findMany({ orderBy: { kickoffAt: "asc" } });
}
