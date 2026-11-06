import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { limeRatio, radiusOnLadder } from "../ui/sleek-lib";

function solid(width: number, height: number, rgb: [number, number, number], block?: number) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const inBlock = block !== undefined && x < block && y < height;
      const [r, g, b] = inBlock ? [200, 245, 46] : rgb;
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = 255;
    }
  return PNG.sync.write(png);
}

describe("sleek helpers (15.5, with negative proofs)", () => {
  it("radius ladder accepts the ladder and rejects 13px (the documented mutation)", () => {
    for (const ok of ["0px", "8px", "12px", "16px", "20px", "24px", "999px", "9999px", "50%"])
      expect(radiusOnLadder(ok)).toBe(true);
    expect(radiusOnLadder("3.35544e+07px")).toBe(true); // rounded-full
    for (const bad of ["13px", "4px", "10px", "11.5px", "30px", "40%"])
      expect(radiusOnLadder(bad)).toBe(false);
  });

  it("an all-dark page has ~0% lime; a large lime block pushes it over the 3% budget", () => {
    expect(limeRatio(solid(100, 100, [14, 21, 19]))).toBe(0);
    expect(limeRatio(solid(100, 100, [14, 21, 19], 2))).toBeLessThan(0.03); // 2% lime: inside the budget
    expect(limeRatio(solid(100, 100, [14, 21, 19], 10))).toBeGreaterThan(0.03); // 10%: fails
  });

  it("soft lime blends (>=40%) count, faint tints and white/grey/semantic colours do not", () => {
    // 50% lime over the surface
    expect(limeRatio(solid(10, 10, [107, 133, 33]))).toBe(1);
    // 15% tint (primary-soft level) is below the 40% line
    expect(limeRatio(solid(10, 10, [42, 55, 25]))).toBe(0);
    for (const rgb of [
      [242, 247, 244],
      [154, 171, 164],
      [46, 229, 157],
      [255, 107, 107],
    ] as [number, number, number][])
      expect(limeRatio(solid(10, 10, rgb))).toBe(0);
  });
});
