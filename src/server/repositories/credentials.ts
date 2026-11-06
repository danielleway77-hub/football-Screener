import { getDb } from "@/lib/db";

/** Password-hash override set on password change; null means "use APP_PASSWORD_HASH from the environment". */
export async function getPasswordHash(): Promise<string | null> {
  const row = await getDb().credential.findUnique({ where: { id: 1 } });
  return row?.passwordHash ?? null;
}

export async function setPasswordHash(passwordHash: string): Promise<void> {
  await getDb().credential.upsert({
    where: { id: 1 },
    update: { passwordHash },
    create: { id: 1, passwordHash },
  });
}

/**
 * Writes the new hash AND bumps Setting.sessionVersion in ONE transaction, so a password change can never
 * leave old sessions valid. Returns the new session version.
 */
export async function replacePasswordAndBumpSessions(passwordHash: string): Promise<number> {
  return getDb().$transaction(async (tx) => {
    await tx.credential.upsert({
      where: { id: 1 },
      update: { passwordHash },
      create: { id: 1, passwordHash },
    });
    await tx.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    const row = await tx.setting.update({
      where: { id: 1 },
      data: { sessionVersion: { increment: 1 } },
    });
    return row.sessionVersion;
  });
}
