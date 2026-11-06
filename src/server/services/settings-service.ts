import { validateThresholds } from "@/server/domain/screening";
import { settingsUpdateSchema, type SettingsUpdate } from "@/lib/schemas/settings";
import { AppError } from "@/server/errors";
import * as matches from "@/server/repositories/matches";
import * as settingsRepo from "@/server/repositories/settings";
import type { SettingRecord } from "@/server/repositories/types";
import { rescreenAll } from "@/server/services/run-service";

export { settingsUpdateSchema };
export type { SettingsUpdate };

/** What the API and the Settings page see: never the session version. */
export type PublicSettings = Omit<
  SettingRecord,
  "id" | "sessionVersion" | "updatedAt" | "windowDays"
> & {
  windowDays: 1 | 2;
};

export function toPublicSettings(s: SettingRecord): PublicSettings {
  return {
    highThreshold: s.highThreshold,
    lowThreshold: s.lowThreshold,
    windowDays: s.windowDays === 1 ? 1 : 2,
    formScope: s.formScope,
    timezone: s.timezone,
    runHourLocal: s.runHourLocal,
    accessMode: s.accessMode,
    staleAfterHrs: s.staleAfterHrs,
  };
}

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
      const key = String(issue.path[0] ?? "settings");
      fieldErrors[key] ??= issue.message;
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

export type RescreenResult = { changed: number; qualifying: number };

/**
 * Save from the Settings page. Changed thresholds are applied to the stored matches right away
 * (the dashboard lists stored verdicts). When the re-screen cannot run (an update is in progress)
 * the settings stay saved and `rescreenSkipped` tells the UI to offer the manual button.
 */
export async function saveSettings(input: unknown): Promise<{
  settings: PublicSettings;
  thresholdsChanged: boolean;
  windowChanged: boolean;
  rescreen: RescreenResult | null;
  rescreenSkipped: string | null;
}> {
  const { settings, thresholdsChanged, windowChanged } = await updateSettings(input);
  let rescreen: RescreenResult | null = null;
  let rescreenSkipped: string | null = null;
  if (thresholdsChanged) {
    try {
      rescreen = await rescreenAll(settings);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      rescreenSkipped = error.message;
    }
  }
  return {
    settings: toPublicSettings(settings),
    thresholdsChanged,
    windowChanged,
    rescreen,
    rescreenSkipped,
  };
}

/** Re-screen with the stored thresholds (Maintenance card). */
export async function rescreenStored(): Promise<RescreenResult & { total: number }> {
  const settings = await settingsRepo.getSettings();
  const result = await rescreenAll(settings);
  return { ...result, total: await matches.countAll() };
}

export async function countStoredMatches(): Promise<number> {
  return matches.countAll();
}
