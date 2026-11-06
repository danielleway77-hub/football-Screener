"use client";

import { useReducedMotion } from "framer-motion";
import { useHydrated } from "@/hooks/useHydrated";

/**
 * Shared motion tokens (docs/ThemeGuideline.md §7, UI_BLUEPRINT §26 "calm precision").
 * All animation in feature code goes through components/motion/* which use these values.
 * NOTE: GSAP is NOT used in the kit; it is dynamically imported only on the login page (Step 15.1).
 */
/**
 * Delight flags (UI_BLUEPRINT §25-27): each effect is removable by flipping ONE constant.
 * FEATURE_VIEW_TRANSITIONS stays false: see docs/PROJECT_STATE.md (Step 15.4 decision).
 */
export const FEATURE_SPOTLIGHT = true;
export const FEATURE_CARD_SHEEN = true;
export const FEATURE_VIEW_TRANSITIONS = false;

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
export const SPRING = { type: "spring", stiffness: 380, damping: 30 } as const;

export const DURATION = {
  micro: 0.15,
  ui: 0.28,
  reveal: 0.5,
  page: 0.35,
  bar: 0.7,
  countUp: 0.8,
} as const;

/** One stagger step and the cap on how many siblings animate (the rest appear instantly). */
export const STAGGER_STEP = 0.06;
export const STAGGER_MAX_ITEMS = 8;
/** Longest delay a bar fill may get (index × 60ms, capped). */
export const BAR_MAX_DELAY = 0.48;

export const HIDDEN = { opacity: 0, y: 8 } as const;
export const VISIBLE = { opacity: 1, y: 0 } as const;

export const revealTransition = { duration: DURATION.reveal, ease: EASE_OUT } as const;

export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: STAGGER_STEP } },
} as const;

export const staggerItem = {
  hidden: HIDDEN,
  visible: { ...VISIBLE, transition: { duration: 0.4, ease: EASE_OUT } },
} as const;

/**
 * `reduce` is true when the user prefers reduced motion: render final states immediately.
 * It is false during the server render AND the hydration render (even if the browser prefers reduced
 * motion) so the first client render has the same tree and the same useId() values as the server HTML;
 * it flips right after hydration. (Reading the media query on the first client render caused
 * hydration/ID mismatches for reduced-motion visitors.)
 */
export function useMotionPrefs(): { reduce: boolean } {
  const hydrated = useHydrated();
  const media = useReducedMotion() ?? false;
  return { reduce: hydrated && media };
}
