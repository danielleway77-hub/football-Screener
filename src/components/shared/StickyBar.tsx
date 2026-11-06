"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type StickyBarProps = {
  /** Distance from the top of the viewport where the bar docks (default: under the 64px navbar). */
  top?: number;
  className?: string;
  /** Render prop receives whether the bar is currently docked (stuck). */
  children: React.ReactNode | ((isStuck: boolean) => React.ReactNode);
};

/**
 * Sentinel-based sticky container. In normal flow it is transparent; once it reaches `top` it becomes
 * `.glass` with a hairline. The vertical padding is constant so docking never shifts the layout.
 * z-index 39 sits just below the navbar (40).
 */
export function StickyBar({ top = 64, className, children }: StickyBarProps) {
  const sentinel = React.useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = React.useState(false);

  React.useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    // The sentinel is a 1px element directly above the bar. When it scrolls above the dock line,
    // the bar is stuck.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setStuck(!entry.isIntersecting && entry.boundingClientRect.top < top);
      },
      { rootMargin: `-${top}px 0px 0px 0px`, threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [top]);

  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="pointer-events-none h-px w-full" />
      <div
        data-testid="sticky-bar"
        data-stuck={stuck}
        className={cn(
          "sticky z-[39] -mt-px py-2 transition-[background-color,border-color,backdrop-filter] duration-150 motion-reduce:transition-none",
          stuck ? "glass" : "border-b border-transparent bg-transparent",
          className,
        )}
        style={{ top }}
      >
        {typeof children === "function" ? children(stuck) : children}
      </div>
    </>
  );
}
