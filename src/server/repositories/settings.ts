import { getDb } from "@/lib/db";
import type { SettingRecord, SettingUpdate } from "./types";

/** The singleton row (id = 1); created with schema defaults on first access. */
export async function ensureSettings(): Promise<SettingRecord> {
  return getDb().setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

/** Read-only: returns the row, or defaults-by-creation only if it does not exist yet. */
export async function getSettings(): Promise<SettingRecord> {
  return (await getDb().setting.findUnique({ where: { id: 1 } })) ?? ensureSettings();
}

export async function updateSettings(patch: SettingUpdate): Promise<SettingRecord> {
  await ensureSettings();
  return getDb().setting.update({ where: { id: 1 }, data: patch });
}

export async function bumpSessionVersion(): Promise<SettingRecord> {
  await ensureSettings();
  return getDb().setting.update({ where: { id: 1 }, data: { sessionVersion: { increment: 1 } } });
}
