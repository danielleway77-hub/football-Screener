import { PNG } from "pngjs";

/** Pure helpers behind tests/ui/sleek.spec.ts (unit-tested in tests/unit/sleek-lib.test.ts). */

export const RADIUS_LADDER_PX = [0, 8, 12, 16, 20, 24, 999, 9999];

/** `true` when a computed border-radius corner value is on the ladder (px, % circle, or a pill). */
export function radiusOnLadder(value: string): boolean {
  const v = value.trim();
  if (v === "50%" || v === "0px") return true;
  const m = v.match(/^([\d.]+(?:e[+-]?\d+)?)px$/);
  if (!m) return false;
  const px = Number(m[1]);
  return px >= 999 || RADIUS_LADDER_PX.includes(px); // 999px / 9999px / "3.35544e+07px" (rounded-full)
}

const LIME = [200, 245, 46] as const; // --primary #C8F52E
const BASE = [14, 21, 19] as const; // --surface #0e1513 (what lime blends over on cards)

/**
 * Share of pixels that are lime or a lime blend of at least 40% over the dark surface: the pixel lies on
 * the segment surface -> lime at t >= 0.4 and within 24 colour units of it. Grey text anti-aliasing and the
 * semantic greens/reds are far from that line, so they do not count.
 */
export function limeRatio(png: Buffer): number {
  const img = PNG.sync.read(png);
  const dx = LIME[0] - BASE[0];
  const dy = LIME[1] - BASE[1];
  const dz = LIME[2] - BASE[2];
  const len2 = dx * dx + dy * dy + dz * dz;
  let hits = 0;
  const total = img.width * img.height;
  for (let i = 0; i < img.data.length; i += 4) {
    const px = img.data[i]! - BASE[0];
    const py = img.data[i + 1]! - BASE[1];
    const pz = img.data[i + 2]! - BASE[2];
    const t = (px * dx + py * dy + pz * dz) / len2;
    if (t < 0.4 || t > 1.15) continue;
    const rx = px - t * dx;
    const ry = py - t * dy;
    const rz = pz - t * dz;
    if (Math.hypot(rx, ry, rz) < 24) hits++;
  }
  return hits / total;
}
