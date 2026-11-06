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
