import { getDb } from "@/lib/db";

/** Atomically increments the fixed-window counter for `key` and returns the new count. */
export async function increment(key: string, windowStart: Date): Promise<number> {
  const row = await getDb().rateLimit.upsert({
    where: { key },
    update: { count: { increment: 1 } },
    create: { key, count: 1, windowStart },
  });
  return row.count;
}

export async function purgeOlderThan(date: Date): Promise<number> {
  const r = await getDb().rateLimit.deleteMany({ where: { windowStart: { lt: date } } });
  return r.count;
}
