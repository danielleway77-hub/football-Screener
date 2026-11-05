"use client";

import * as React from "react";

const QUERY = "(hover: hover) and (pointer: fine)";

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

/** `true` only on devices with a real hovering pointer (mouse/trackpad). SSR-safe: false on the server. */
export function useHoverCapable(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
