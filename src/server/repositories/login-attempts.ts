import { getDb } from "@/lib/db";

export async function record(ip: string, success: boolean, at: Date): Promise<void> {
  await getDb().loginAttempt.create({ data: { ip, success, at } });
}

/** Failed attempts from `ip` at or after `since`. */
export async function countRecentFailures(ip: string, since: Date): Promise<number> {
  return getDb().loginAttempt.count({ where: { ip, success: false, at: { gte: since } } });
}

/** Timestamps (ascending) of failed attempts from `ip` at or after `since`. */
export async function recentFailureTimes(ip: string, since: Date): Promise<Date[]> {
  const rows = await getDb().loginAttempt.findMany({
    where: { ip, success: false, at: { gte: since } },
    orderBy: { at: "asc" },
    select: { at: true },
  });
  return rows.map((r) => r.at);
}

/** Failed attempts from any address at or after `since` (global backstop). */
export async function countAllRecentFailures(since: Date): Promise<number> {
  return getDb().loginAttempt.count({ where: { success: false, at: { gte: since } } });
}

export async function purge(olderThan: Date): Promise<number> {
  const r = await getDb().loginAttempt.deleteMany({ where: { at: { lt: olderThan } } });
  return r.count;
}
