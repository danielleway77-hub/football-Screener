"use client";

import * as React from "react";
import { FEATURE_CARD_SHEEN, useMotionPrefs } from "@/lib/motion";

/**
 * Qualifying-card border sheen (Step 15.1): a conic highlight travels around the 1px hairline in 6 s
 * (transform: rotate only; the ring is a CSS mask). It only runs while the card is on screen: an
 * IntersectionObserver toggles `data-active`, CSS pauses the animation otherwise. Under reduced motion
 * the CSS hides it entirely. Place inside a `position: relative; border-radius` card.
 */
export function CardSheen() {
  const { reduce } = useMotionPrefs();
  const ref = React.useRef<HTMLSpanElement>(null);
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!FEATURE_CARD_SHEEN || reduce || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setActive(entry?.isIntersecting ?? false));
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  if (!FEATURE_CARD_SHEEN) return null;
  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-testid="card-sheen"
      data-active={active && !reduce}
      className="card-sheen"
    >
      <span className="card-sheen-beam" />
    </span>
  );
}
