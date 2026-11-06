"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * After a client-side navigation, move keyboard focus to <main id="main"> so screen-reader and
 * keyboard users start at the new page's content (not stranded on the link they clicked).
 * Does nothing on the first load and does not scroll.
 */
function Focuser() {
  const pathname = usePathname();
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}

export function RouteFocus() {
  return (
    <React.Suspense fallback={null}>
      <Focuser />
    </React.Suspense>
  );
}
