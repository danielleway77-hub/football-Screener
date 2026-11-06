import { describe, expect, it } from "vitest";
import {
  LOGIN_FIELD_COUNT,
  LOGIN_IMPORT_TIMEOUT_MS,
  LOGIN_TIMELINE as T,
  loginTimelineEnd,
} from "@/lib/login-motion";

// Step 15.1: the login timeline table from MASTER_GUIDE 15.1 "LOGIN GSAP TIMELINE".
describe("login entrance timeline", () => {
  it("matches the specified times and durations", () => {
    expect([T.glow.at, T.glow.duration]).toEqual([0, 0.6]);
    expect([T.logo.at, T.logo.duration, T.logo.y]).toEqual([0.1, 0.45, 12]);
    expect([T.card.at, T.card.duration, T.card.y]).toEqual([0.22, 0.5, 16]);
    expect([T.fields.at, T.fields.stagger, T.fields.duration, T.fields.y]).toEqual([
      0.36, 0.06, 0.35, 8,
    ]);
    expect([T.glyph.at, T.glyph.duration]).toEqual([0.6, 0.6]);
    expect(LOGIN_FIELD_COUNT).toBe(3);
  });

  it("is ordered logo -> card -> fields -> glyph and ends within 1.2 s", () => {
    expect(T.logo.at).toBeLessThan(T.card.at);
    expect(T.card.at).toBeLessThan(T.fields.at);
    expect(T.fields.at).toBeLessThan(T.glyph.at);
    expect(loginTimelineEnd()).toBeCloseTo(1.2, 5);
    expect(loginTimelineEnd()).toBeLessThanOrEqual(1.2);
  });

  it("skips (never blanks visible content) when the chunk is slow", () => {
    expect(LOGIN_IMPORT_TIMEOUT_MS).toBeLessThanOrEqual(600);
  });
});
