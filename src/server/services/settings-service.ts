import { z } from "zod";
import { validateThresholds } from "@/server/domain/screening";
import { AppError } from "@/server/errors";
import * as settingsRepo from "@/server/repositories/settings";
import type { SettingRecord } from "@/server/repositories/types";

function isTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const settingsUpdateSchema = z
  .object({
    highThreshold: z.number().int().min(0).max(100),
    lowThreshold: z.number().int().min(0).max(100),
    windowDays: z.union([z.literal(1), z.literal(2)]),
    formScope: z.enum(["league", "overall"]),
    timezone: z.string().min(1).max(64).refine(isTimezone, "Unknown timezone"),
    runHourLocal: z.number().int().min(0).max(23),
    accessMode: z.enum(["official_api", "assisted_ingest", "manual_import"]),
    staleAfterHrs: z.number().int().min(1).max(168),
  })
  .partial()
  .strict();

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

export async function getSettings(): Promise<SettingRecord> {
  return settingsRepo.getSettings();
}

/**
 * Validates and saves a partial settings update. `thresholdsChanged` tells the caller to run `rescreenAll`
 * (and `windowChanged` that the next pull uses a different window).
 */
export async function updateSettings(input: unknown): Promise<{
  settings: SettingRecord;
  thresholdsChanged: boolean;
  windowChanged: boolean;
}> {
  const parsed = settingsUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "settings")] = issue.message;
    }
    throw new AppError("VALIDATION_FAILED", "Some settings are not valid.", fieldErrors);
  }
  const before = await settingsRepo.getSettings();
  const patch = parsed.data;
  const merged = {
    low: patch.lowThreshold ?? before.lowThreshold,
    high: patch.highThreshold ?? before.highThreshold,
  };
  const check = validateThresholds(merged);
  if (!check.ok) {
    throw new AppError("VALIDATION_FAILED", check.reason, { lowThreshold: check.reason });
  }
  const settings = await settingsRepo.updateSettings(patch);
  return {
    settings,
    thresholdsChanged:
      settings.lowThreshold !== before.lowThreshold ||
      settings.highThreshold !== before.highThreshold,
    windowChanged:
      settings.windowDays !== before.windowDays ||
      settings.timezone !== before.timezone ||
      settings.formScope !== before.formScope,
  };
}
