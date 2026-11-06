/**
 * Login entrance timeline (Step 15.1, MASTER_GUIDE "LOGIN GSAP TIMELINE"). Times in seconds.
 * Pure data: no GSAP import here, so unit tests and other bundles never pull the library in.
 * Total must stay <= 1.2 s (measured budget 1.3 s).
 */
export const LOGIN_TIMELINE = {
  glow: { at: 0, duration: 0.6 },
  logo: { at: 0.1, duration: 0.45, y: 12, ease: "power3.out" },
  card: { at: 0.22, duration: 0.5, y: 16, ease: "power3.out" },
  fields: { at: 0.36, duration: 0.35, y: 8, stagger: 0.06, ease: "power3.out" },
  glyph: { at: 0.6, duration: 0.6, ease: "power2.out" },
} as const;

/** The 3 field groups that stagger in (password block, submit block, footnote). */
export const LOGIN_FIELD_COUNT = 3;

/** End time of the whole timeline, derived from the table above. */
export function loginTimelineEnd(): number {
  const t = LOGIN_TIMELINE;
  return Math.max(
    t.glow.at + t.glow.duration,
    t.logo.at + t.logo.duration,
    t.card.at + t.card.duration,
    t.fields.at + t.fields.stagger * (LOGIN_FIELD_COUNT - 1) + t.fields.duration,
    t.glyph.at + t.glyph.duration,
  );
}

/** If the GSAP chunk has not arrived by then, skip the entrance (content is already on screen). */
export const LOGIN_IMPORT_TIMEOUT_MS = 600;
