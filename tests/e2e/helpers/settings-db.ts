import { withClient } from "./dashboard-db";

/** Puts the Setting row back to the product defaults and clears tokens, rate limits and password override. */
export async function resetSettingsState() {
  await withClient(async (c) => {
    await c.query(
      'INSERT INTO "Setting" ("id","updatedAt") VALUES (1, now()) ON CONFLICT ("id") DO NOTHING',
    );
    await c.query(
      `UPDATE "Setting" SET "highThreshold" = 75, "lowThreshold" = 35, "windowDays" = 2, "formScope" = 'league',
         "timezone" = 'Europe/London', "accessMode" = 'manual_import', "staleAfterHrs" = 26 WHERE "id" = 1`,
    );
    await c.query('DELETE FROM "IngestToken"');
    await c.query('DELETE FROM "LoginAttempt"');
    await c.query('DELETE FROM "RateLimit"');
    await c.query('DELETE FROM "Credential"');
  });
}

export async function readSettingsRow(): Promise<{
  highThreshold: number;
  lowThreshold: number;
  windowDays: number;
  timezone: string;
  staleAfterHrs: number;
  sessionVersion: number;
}> {
  return withClient(async (c) => {
    const r = await c.query(
      'SELECT "highThreshold","lowThreshold","windowDays","timezone","staleAfterHrs","sessionVersion" FROM "Setting" WHERE "id" = 1',
    );
    return r.rows[0];
  });
}

/** Restores the shared e2e login after a password-change test (cookie version + no hash override). */
export async function restoreSession(version: number) {
  await withClient(async (c) => {
    await c.query('DELETE FROM "Credential"');
    await c.query('UPDATE "Setting" SET "sessionVersion" = $1 WHERE "id" = 1', [version]);
    await c.query('DELETE FROM "LoginAttempt"');
  });
}

export async function qualifiesById(): Promise<Record<string, boolean>> {
  return withClient(async (c) => {
    const r = await c.query('SELECT "id","qualifies" FROM "Match"');
    return Object.fromEntries(
      r.rows.map((x: { id: string; qualifies: boolean }) => [x.id, x.qualifies]),
    );
  });
}
