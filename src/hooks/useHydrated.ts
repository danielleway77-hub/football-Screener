"use client";

import * as React from "react";

const noopSubscribe = () => () => {};

/**
 * `false` during SSR and the hydration render, `true` afterwards. Exposed as `data-hydrated` on key
 * client roots so browser tests can wait until event handlers are attached (instead of guessing with
 * network-idle or timeouts).
 */
export function useHydrated(): boolean {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
