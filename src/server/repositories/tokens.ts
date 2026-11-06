import { getDb } from "@/lib/db";
import type { TokenRecord } from "./types";

/** Stores only the hash (sha256 hex) of a token; the plaintext is shown once by the service, never kept. */
export async function create(label: string, tokenHash: string): Promise<TokenRecord> {
  return getDb().ingestToken.create({ data: { label, tokenHash } });
}

export async function findByHash(tokenHash: string): Promise<TokenRecord | null> {
  return getDb().ingestToken.findUnique({ where: { tokenHash } });
}

export async function touch(id: string, at: Date): Promise<void> {
  await getDb().ingestToken.update({ where: { id }, data: { lastUsedAt: at } });
}

export async function list(): Promise<TokenRecord[]> {
  return getDb().ingestToken.findMany({ orderBy: { createdAt: "desc" } });
}

/** Revokes once; revoking again keeps the original revokedAt. Returns null for an unknown id. */
export async function revoke(id: string, at: Date): Promise<TokenRecord | null> {
  const db = getDb();
  await db.ingestToken.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: at } });
  return db.ingestToken.findUnique({ where: { id } });
}

export async function countActive(): Promise<number> {
  return getDb().ingestToken.count({ where: { revokedAt: null } });
}

/** Counts active tokens and inserts in ONE transaction under an advisory lock (no cap race). Null = cap reached. */
export async function createIfBelowCap(
  label: string,
  tokenHash: string,
  cap: number,
): Promise<TokenRecord | null> {
  return getDb().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(913001)`;
    const active = await tx.ingestToken.count({ where: { revokedAt: null } });
    if (active >= cap) return null;
    return tx.ingestToken.create({ data: { label, tokenHash } });
  });
}
