import { getDb } from "@/lib/db";

/** `select 1` with a hard timeout. Returns false instead of throwing (health must never crash). */
export async function ping(timeoutMs = 2000): Promise<boolean> {
  try {
    await Promise.race([
      getDb().$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);
    return true;
  } catch {
    return false;
  }
}
