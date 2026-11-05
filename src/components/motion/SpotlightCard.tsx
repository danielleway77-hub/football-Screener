"use client";

import * as React from "react";
import { useHoverCapable } from "@/hooks/useHoverCapable";
import { useMotionPrefs } from "@/lib/motion";
import { cn } from "@/lib/utils";

type SpotlightCardProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Soft lime glow that follows the pointer (UI_BLUEPRINT §25). Active ONLY on hover-capable devices
 * and without reduced motion; otherwise it adds no listeners and no overlay at all. The overlay sits
 * under the content (z-0 vs z-10) so text stays crisp. Put it on cards that have a radius: the
 * overlay inherits it.
 */
export function SpotlightCard({ children, className }: SpotlightCardProps) {
  const capable = useHoverCapable();
  const { reduce } = useMotionPrefs();
  const active = capable && !reduce;
  const ref = React.useRef<HTMLDivElement>(null);
  const [on, setOn] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    let frame = 0;
    let lastX = 0;
    let lastY = 0;

    const paint = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${lastX - rect.left}px`);
      el.style.setProperty("--my", `${lastY - rect.top}px`);
    };
    const onMove = (event: PointerEvent) => {
      lastX = event.clientX;
      lastY = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint); // at most one update per frame
    };
    const onEnter = () => setOn(true);
    const onLeave = () => setOn(false);

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [active]);

  return (
    <div ref={ref} data-spotlight={active ? "active" : "off"} className={cn("relative", className)}>
      {active ? (
        <span
          aria-hidden="true"
          data-testid="spotlight-overlay"
          className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] transition-opacity duration-200"
          style={{ background: "var(--spotlight)", opacity: on ? 1 : 0 }}
        />
      ) : null}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
