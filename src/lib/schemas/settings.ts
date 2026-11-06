import { z } from "zod";

/**
 * Settings validation shared by the Settings form (client) and PUT /api/settings (server).
 * Thresholds: integers 0–100 with `low < high`. Window: 1 or 2 days. Timezone: any IANA name the
 * runtime knows. Stale-after: 1–168 hours.
 */
export const LOW_HIGH_MESSAGE = "The lower threshold must be below the upper threshold.";
const WHOLE_PCT = "Enter a whole number from 0 to 100.";
const WHOLE_HOURS = "Enter a whole number of hours from 1 to 168.";

export function isTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const pct = z.number({ error: WHOLE_PCT }).int(WHOLE_PCT).min(0, WHOLE_PCT).max(100, WHOLE_PCT);

export const settingsShape = {
  highThreshold: pct,
  lowThreshold: pct,
  windowDays: z.union([z.literal(1), z.literal(2)], { error: "Choose 1 or 2 days." }),
  formScope: z.enum(["league", "overall"], { error: "Choose league form or overall form." }),
  timezone: z.string().min(1, "Choose a timezone.").max(64).refine(isTimezone, "Unknown timezone"),
  runHourLocal: z.number().int().min(0).max(23),
  accessMode: z.enum(["official_api", "assisted_ingest", "manual_import"], {
    error: "Choose how data reaches the app.",
  }),
  staleAfterHrs: z
    .number({ error: WHOLE_HOURS })
    .int(WHOLE_HOURS)
    .min(1, WHOLE_HOURS)
    .max(168, WHOLE_HOURS),
};

type LowHigh = { lowThreshold?: number; highThreshold?: number };

/** `low < high` whenever both are present (the server merges with stored values for partial updates). */
function checkLowHigh(value: LowHigh, ctx: z.RefinementCtx) {
  if (
    value.lowThreshold !== undefined &&
    value.highThreshold !== undefined &&
    value.lowThreshold >= value.highThreshold
  ) {
    ctx.addIssue({ code: "custom", path: ["lowThreshold"], message: LOW_HIGH_MESSAGE });
  }
}

/** Partial update accepted by the API (unknown keys are rejected). */
export const settingsUpdateSchema = z
  .object(settingsShape)
  .partial()
  .strict()
  .superRefine(checkLowHigh);

/** What the Settings form edits (the daily run hour is informational and not part of the form). */
export const settingsFormSchema = z
  .object({
    highThreshold: settingsShape.highThreshold,
    lowThreshold: settingsShape.lowThreshold,
    windowDays: settingsShape.windowDays,
    formScope: settingsShape.formScope,
    timezone: settingsShape.timezone,
    accessMode: settingsShape.accessMode,
    staleAfterHrs: settingsShape.staleAfterHrs,
  })
  .superRefine(checkLowHigh);

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

export const MIN_PASSWORD_LENGTH = 10;
const SHORT_PASSWORD = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
const LONG_PASSWORD = "Use at most 72 bytes (bcrypt limit); shorten the password.";
const bytes72 = (v: string) => new TextEncoder().encode(v).length <= 72;
const SAME_PASSWORD = "Choose a password that is different from the current one.";

/** Password change body: shared by the form and POST /api/settings/password. */
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(200),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, SHORT_PASSWORD)
      .max(200, "That password is too long.")
      .refine(bytes72, LONG_PASSWORD),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword === value.currentPassword) {
      ctx.addIssue({ code: "custom", path: ["newPassword"], message: SAME_PASSWORD });
    }
  });

export const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(200),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, SHORT_PASSWORD)
      .max(200, "That password is too long.")
      .refine(bytes72, LONG_PASSWORD),
    confirmPassword: z.string().min(1, "Repeat the new password."),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword && value.newPassword === value.currentPassword) {
      ctx.addIssue({ code: "custom", path: ["newPassword"], message: SAME_PASSWORD });
    }
    if (value.confirmPassword && value.confirmPassword !== value.newPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "The two passwords do not match.",
      });
    }
  });

export type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export const MAX_ACTIVE_TOKENS = 5;
