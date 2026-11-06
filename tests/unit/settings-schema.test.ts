import { describe, expect, it } from "vitest";
import {
  passwordFormSchema,
  settingsFormSchema,
  settingsUpdateSchema,
} from "@/lib/schemas/settings";

const valid = {
  highThreshold: 75,
  lowThreshold: 35,
  windowDays: 2,
  formScope: "league",
  timezone: "Europe/London",
  accessMode: "manual_import",
  staleAfterHrs: 26,
};

const firstIssue = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => result.error?.issues[0];

describe("settings schema", () => {
  it("accepts the defaults", () => {
    expect(settingsFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects low >= high (equal and inverted), windowDays 3, a bad timezone and staleAfterHrs 0", () => {
    const equal = settingsFormSchema.safeParse({ ...valid, lowThreshold: 60, highThreshold: 60 });
    expect(equal.success).toBe(false);
    expect(firstIssue(equal)).toMatchObject({ path: ["lowThreshold"] });
    expect(
      settingsFormSchema.safeParse({ ...valid, lowThreshold: 80, highThreshold: 70 }).success,
    ).toBe(false);
    expect(settingsFormSchema.safeParse({ ...valid, windowDays: 3 }).success).toBe(false);
    expect(settingsFormSchema.safeParse({ ...valid, timezone: "Mars/Olympus" }).success).toBe(
      false,
    );
    expect(settingsFormSchema.safeParse({ ...valid, staleAfterHrs: 0 }).success).toBe(false);
  });

  it("enforces the edges: integers 0-100, stale 1-168", () => {
    expect(
      settingsFormSchema.safeParse({ ...valid, lowThreshold: 0, highThreshold: 1 }).success,
    ).toBe(true);
    expect(
      settingsFormSchema.safeParse({ ...valid, lowThreshold: 99, highThreshold: 100 }).success,
    ).toBe(true);
    expect(settingsFormSchema.safeParse({ ...valid, highThreshold: 101 }).success).toBe(false);
    expect(settingsFormSchema.safeParse({ ...valid, lowThreshold: -1 }).success).toBe(false);
    expect(settingsFormSchema.safeParse({ ...valid, highThreshold: 70.5 }).success).toBe(false);
    expect(settingsFormSchema.safeParse({ ...valid, staleAfterHrs: 168 }).success).toBe(true);
    expect(settingsFormSchema.safeParse({ ...valid, staleAfterHrs: 169 }).success).toBe(false);
  });

  it("the API schema is partial and strict (unknown keys such as sessionVersion are refused)", () => {
    expect(settingsUpdateSchema.safeParse({ windowDays: 1 }).success).toBe(true);
    expect(settingsUpdateSchema.safeParse({ sessionVersion: 9 }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ lowThreshold: 50, highThreshold: 50 }).success).toBe(
      false,
    );
  });
});

describe("password form schema", () => {
  const base = {
    currentPassword: "old-password-1",
    newPassword: "new-password-12",
    confirmPassword: "new-password-12",
  };

  it("accepts a valid change", () => {
    expect(passwordFormSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a short, unchanged or mismatching new password", () => {
    expect(
      passwordFormSchema.safeParse({ ...base, newPassword: "short", confirmPassword: "short" })
        .success,
    ).toBe(false);
    const same = passwordFormSchema.safeParse({
      ...base,
      newPassword: "old-password-1",
      confirmPassword: "old-password-1",
    });
    expect(firstIssue(same)).toMatchObject({ path: ["newPassword"] });
    const mismatch = passwordFormSchema.safeParse({ ...base, confirmPassword: "different-pass-1" });
    expect(firstIssue(mismatch)).toMatchObject({ path: ["confirmPassword"] });
  });
});
