"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Protects unsaved edits: the browser's own prompt for reloads/tab close (beforeunload) and, for in-app
 * navigation (any same-origin link to ANOTHER page), a capture-phase click interceptor that stores the
 * target and lets the caller show its own confirm dialog. `confirmLeave` then navigates; `stay` cancels.
 * Back/forward buttons are covered by beforeunload only on a real unload (documented limitation).
 */
export function useUnsavedGuard(dirty: boolean) {
  const router = useRouter();
  const [target, setTarget] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !anchor ||
        (anchor.target && anchor.target !== "_self") ||
        anchor.hasAttribute("download")
      ) {
        return;
      }
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search)
        return;
      event.preventDefault();
      event.stopPropagation();
      setTarget(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  return {
    leaveOpen: target !== null && dirty,
    stay: () => setTarget(null),
    confirmLeave: () => {
      const to = target;
      setTarget(null);
      if (to) router.push(to);
    },
  };
}
