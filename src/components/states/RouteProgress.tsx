"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Phase = "idle" | "loading" | "done";

/** Is this click an in-app navigation to a different URL? */
function isInternalNavigation(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return url.pathname + url.search !== window.location.pathname + window.location.search;
}

function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const key = `${pathname}?${search}`;
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [seenKey, setSeenKey] = React.useState(key);

  // The URL changed → the navigation finished (derive state during render; no effect needed).
  if (seenKey !== key) {
    setSeenKey(key);
    if (phase === "loading") setPhase("done");
  }

  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (isInternalNavigation(event)) setPhase("loading");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  React.useEffect(() => {
    if (phase === "done") {
      const timer = setTimeout(() => setPhase("idle"), 300);
      return () => clearTimeout(timer);
    }
    if (phase === "loading") {
      // Failsafe: never leave the bar running if a navigation is cancelled.
      const timer = setTimeout(() => setPhase("idle"), 10_000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  return (
    <div
      aria-hidden="true"
      data-testid="route-progress"
      data-phase={phase}
      className="pointer-events-none fixed inset-x-0 top-0 h-0.5"
      style={{ zIndex: "var(--z-progress)" }}
    >
      <div
        className="h-full bg-primary"
        style={{
          width: phase === "idle" ? "0%" : phase === "loading" ? "80%" : "100%",
          opacity: phase === "done" ? 0 : phase === "idle" ? 0 : 1,
          transition:
            phase === "loading"
              ? "width 600ms var(--ease-out)"
              : phase === "done"
                ? "width 150ms var(--ease-out), opacity 200ms 150ms linear"
                : "none",
        }}
      />
    </div>
  );
}

/** 2px lime bar at the very top during in-app navigation (UI spec: Step 3.2). */
export function RouteProgress() {
  return (
    <React.Suspense fallback={null}>
      <Bar />
    </React.Suspense>
  );
}
