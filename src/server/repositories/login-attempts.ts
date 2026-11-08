import { getDb } from "@/lib/db";
import { readQuery } from "@/lib/db-retry";

export async function record(ip: string, success: boolean, at: Date): Promise<void> {
  await getDb().loginAttempt.create({ data: { ip, success, at } });
}

/** Records an attempt as a FAILURE first (so parallel guesses all count) and returns its id. */
export async function recordPendingFailure(ip: string, at: Date): Promise<string> {
  const row = await getDb().loginAttempt.create({ data: { ip, success: false, at } });
  return row.id;
}

/** Turns a pending failure into a success once the password was verified. */
export async function markSuccess(id: string): Promise<void> {
  await getDb().loginAttempt.update({ where: { id }, data: { success: true } });
}

/** Failed attempts from `ip` at or after `since`. */
export async function countRecentFailures(ip: string, since: Date): Promise<number> {
  return readQuery(() =>
    getDb().loginAttempt.count({ where: { ip, success: false, at: { gte: since } } }),
  );
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
  return readQuery(() =>
    getDb().loginAttempt.count({ where: { success: false, at: { gte: since } } }),
  );
}

export async function purge(olderThan: Date): Promise<number> {
  const r = await getDb().loginAttempt.deleteMany({ where: { at: { lt: olderThan } } });
  return r.count;
}
