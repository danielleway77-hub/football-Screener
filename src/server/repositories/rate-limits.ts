import { getDb } from "@/lib/db";

/**
 * Atomically increments the fixed-window counter for `key` and returns the new count. A single
 * INSERT … ON CONFLICT statement: two concurrent first requests cannot collide on the unique key.
 */
export async function increment(key: string, windowStart: Date): Promise<number> {
  const rows = await getDb().$queryRawUnsafe<{ count: number }[]>(
    `INSERT INTO "RateLimit" ("key", "count", "windowStart") VALUES ($1, 1, $2::timestamp)
     ON CONFLICT ("key") DO UPDATE SET "count" = "RateLimit"."count" + 1
     RETURNING "count"`,
    key,
    windowStart.toISOString(),
  );
  return Number(rows[0]!.count);
}

export async function purgeOlderThan(date: Date): Promise<number> {
  const r = await getDb().rateLimit.deleteMany({ where: { windowStart: { lt: date } } });
  return r.count;
}
