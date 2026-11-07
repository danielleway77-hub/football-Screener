"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = { title: string; qualifies: boolean; score: string | null };

/**
 * Compact context bar that fades in once the hero has scrolled out of view. Fixed under the app header,
 * decorative (aria-hidden, not focusable): the hero keeps the real semantics.
 */
export function MatchStickyBar({ title, qualifies, score }: Props) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const hero = document.querySelector('[data-testid="match-hero"]');
    if (!hero) return;
    const io = new IntersectionObserver(
      ([e]) => setShow(!!e && !e.isIntersecting && e.boundingClientRect.top < 0),
      { rootMargin: "-64px 0px 0px 0px" },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, []);
  return (
    <div
      aria-hidden="true"
      data-testid="match-sticky"
      data-visible={show || undefined}
      className={cn(
        "pointer-events-none fixed inset-x-0 top-16 z-30 border-b border-border bg-background/85 backdrop-blur-md transition-[opacity,transform] duration-200 motion-reduce:transition-none",
        show ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
      )}
    >
      <div className="container-wide flex h-10 items-center gap-3 text-sm">
        <span className="min-w-0 flex-1 truncate font-semibold">{title}</span>
        {score ? <span className="num text-muted-foreground">{score}</span> : null}
        <span
          className={cn(
            "text-xs font-bold tracking-wider",
            qualifies ? "text-primary" : "text-warning",
          )}
        >
          {qualifies ? "QUALIFIES" : "NO LONGER"}
        </span>
      </div>
    </div>
  );
}
