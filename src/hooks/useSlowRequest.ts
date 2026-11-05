"use client";

import * as React from "react";

/**
 * `true` once a request has been pending for longer than `thresholdMs` (default 3 s), so the UI can
 * show "Still working…". Resets as soon as the request settles.
 */
export function useSlowRequest(isPending: boolean, thresholdMs = 3000): boolean {
  const [elapsed, setElapsed] = React.useState(false);

  React.useEffect(() => {
    if (!isPending) return;
    const timer = setTimeout(() => setElapsed(true), thresholdMs);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [isPending, thresholdMs]);

  return isPending && elapsed;
}
