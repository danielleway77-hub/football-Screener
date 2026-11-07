import { describe, expect, it } from "vitest";
import { passwordStrength } from "@/components/settings/PasswordForm";
import { countQualifying } from "@/components/settings/ThresholdPreview";
import { evaluateMatch } from "@/server/domain/screening";

describe("settings preview helpers", () => {
  const pairs = [
    [90, 10],
    [10, 90],
    [90, 90],
    [50, 50],
    [75, 10],
    [80, 35],
  ] as const;

  it("counts like the server rule (strict, either side)", () => {
    expect(countQualifying(pairs, 35, 75)).toBe(2);
    expect(countQualifying(pairs, 36, 74)).toBe(4);
    expect(countQualifying([], 35, 75)).toBe(0);
  });

  it("agrees with evaluateMatch for every pair", () => {
    for (const [homeFormPct, awayFormPct] of pairs) {
      const expected = evaluateMatch({ homeFormPct, awayFormPct }, { high: 75, low: 35 }).qualifies;
      expect(countQualifying([[homeFormPct, awayFormPct]], 35, 75)).toBe(expected ? 1 : 0);
    }
  });

  it("rates password strength 0-4 and never rates a short one above 1", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("Ab1!")).toBeLessThanOrEqual(1);
    expect(passwordStrength("correct horse battery Staple 9!")).toBe(4);
  });
});
