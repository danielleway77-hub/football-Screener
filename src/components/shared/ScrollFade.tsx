"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ScrollFadeProps = {
  children: React.ReactNode;
  /** Accessible name; the container is keyboard focusable so arrow keys can scroll it. */
  "aria-label": string;
  className?: string;
};

const FADE = "16px";

/**
 * Horizontal scroller with scroll-snap and 16px edge fades that appear only on a side that has more
 * content (mobile day tabs). Edge state updates on scroll and on resize.
 */
export function ScrollFade({ children, className, "aria-label": ariaLabel }: ScrollFadeProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ left: false, right: false });

  const measure = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [measure]);

  const mask = `linear-gradient(to right, ${edges.left ? "transparent" : "var(--mask-on)"}, var(--mask-on) ${edges.left ? FADE : "0"}, var(--mask-on) calc(100% - ${edges.right ? FADE : "0px"}), ${edges.right ? "transparent" : "var(--mask-on)"})`;

  return (
    <div
      ref={ref}
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      onScroll={measure}
      data-fade-left={edges.left}
      data-fade-right={edges.right}
      className={cn(
        "flex snap-x snap-mandatory [scrollbar-width:none] gap-2 overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden [&>*]:snap-start",
        className,
      )}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {children}
    </div>
  );
}
