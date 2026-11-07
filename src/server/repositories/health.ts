import { getDb } from "@/lib/db";

/**
 * `select 1` with a hard timeout. Returns false instead of throwing (health must never crash) and clears its
 * timer so a fast answer leaves nothing pending. A late rejection of the losing query is swallowed.
 */
export async function ping(timeoutMs = 2000): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const query = getDb().$queryRaw`SELECT 1`;
    query.catch(() => undefined);
    await Promise.race([
      query,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
