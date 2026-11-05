"use client";

import * as React from "react";
import { useHydrated } from "@/hooks/useHydrated";

/**
 * Decided ONCE, at mount: `false` for components that are part of the initial server render
 * (shown immediately, never animated, never hidden waiting for JavaScript) and `true` for components
 * that mount later (client navigation, filter changes, "Replay"). Capturing it in state matters:
 * `useHydrated()` flips to true right after hydration and must NOT retroactively animate the first page.
 */
export function useAnimateOnMount(): boolean {
  const hydrated = useHydrated();
  const [animate] = React.useState(hydrated);
  return animate;
}
