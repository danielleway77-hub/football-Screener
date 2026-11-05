import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as lib from "../../scripts/contrast-lib.mjs";

const css = readFileSync(path.resolve(import.meta.dirname, "../../src/app/globals.css"), "utf8");

describe("contrast helpers", () => {
  it("contrast ratio of black on white is 21", () => {
    const black = lib.parseColor("#000000")!;
    const white = lib.parseColor("#ffffff")!;
    expect(lib.contrastRatio(black, white)).toBeCloseTo(21, 5);
  });

  it("parses hex, short hex, rgb and rgba tokens", () => {
    expect(lib.parseColor("#c8f52e")).toEqual({ r: 200, g: 245, b: 46, a: 1 });
    expect(lib.parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(lib.parseColor("rgba(255, 255, 255, 0.08)")).toEqual({
      r: 255,
      g: 255,
      b: 255,
      a: 0.08,
    });
    expect(lib.parseColor("oklch(1 0 0)")).toBeNull();
  });

  it("composites translucent colours over the surface before measuring", () => {
    const out = lib.composite({ r: 255, g: 255, b: 255, a: 0.5 }, { r: 0, g: 0, b: 0, a: 1 });
    expect(Math.round(out.r)).toBe(128);
  });

  it("resolves var() references and throws on unknown tokens", () => {
    expect(lib.resolve("var(--a)", { "--a": "#fff" })).toBe("#fff");
    expect(() => lib.resolve("var(--missing)", {})).toThrow(/Unknown token/);
  });
});

describe("theme tokens (src/app/globals.css)", () => {
  const results = lib.evaluate(lib.parseRootTokens(css));

  it("covers the required pairs from ThemeGuideline §2.6", () => {
    const has = (fg: string, bg: string) => results.some((r) => r.fg === fg && r.bg === bg);
    expect(has("--text-faint", "--surface-overlay")).toBe(true);
    expect(has("--text-on-accent", "--primary")).toBe(true);
    expect(has("--border-control", "--bg-subtle")).toBe(true);
    expect(has("--primary", "--negative")).toBe(true);
  });

  it("enforces WCAG thresholds: 4.5 for text/accent/semantic pairs, 3 for outlines and focus", () => {
    const pairs = lib.requiredPairs();
    const textLike = pairs.filter((p) =>
      ["text", "accent", "on accent", "semantic"].includes(p.kind),
    );
    const outlines = pairs.filter((p) => ["control outline", "focus ring"].includes(p.kind));
    expect(textLike.length).toBeGreaterThanOrEqual(15);
    expect(textLike.every((p) => p.min === 4.5)).toBe(true);
    expect(outlines.length).toBeGreaterThanOrEqual(3);
    expect(outlines.every((p) => p.min === 3)).toBe(true);
  });

  it("every required pair passes", () => {
    const failing = results
      .filter((r) => !r.pass)
      .map((r) => `${r.fg} on ${r.bg}: ${r.ratio.toFixed(2)}`);
    expect(failing).toEqual([]);
  });

  it("reports reports that lime vs coral is under 3:1 (colour alone is not enough)", () => {
    const pair = results.find((r) => r.fg === "--primary" && r.bg === "--negative");
    expect(pair?.ratio).toBeLessThan(3);
  });

  it("fails when a pair is under its threshold", () => {
    const tokens = lib.parseRootTokens(css);
    tokens["--text-faint"] = "#566761"; // the disabled-text colour: below 4.5:1 on surfaces
    const failing = lib.evaluate(tokens).filter((r: { pass: boolean }) => !r.pass);
    expect(failing.length).toBeGreaterThan(0);
  });
});
