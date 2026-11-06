"use client";

import * as React from "react";

/**
 * A "now" that re-renders every `intervalMs` (default 60 s) and pauses while the tab is hidden.
 * The first value is the server-provided instant, so server and client render the same text
 * (no hydration mismatch); after mount it follows the real clock.
 */
export function useNowTick(initialIso: string, intervalMs = 60_000): number {
  const [now, setNow] = React.useState(() => new Date(initialIso).getTime());

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (timer) return;
      setNow(Date.now());
      timer = setInterval(() => setNow(Date.now()), intervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [intervalMs]);

  return now;
}
