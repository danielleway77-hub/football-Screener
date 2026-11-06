"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SectionLink = { id: string; label: string };

/**
 * Sticky section index (>= 1024px). The current section is highlighted (primary text + 2px left bar),
 * tracked with an IntersectionObserver band near the top of the viewport; at the very bottom of the page
 * the last section wins. Clicks scroll smoothly unless the user prefers reduced motion.
 */
export function SectionNav({ sections }: { sections: SectionLink[] }) {
  const [current, setCurrent] = React.useState(sections[0]?.id ?? "");

  React.useEffect(() => {
    const visible = new Set<string>();
    const order = sections.map((s) => s.id);
    const pick = () => {
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom && window.scrollY > 0) return setCurrent(order[order.length - 1]!);
      const first = order.find((id) => visible.has(id));
      if (first) setCurrent(first);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        pick();
      },
      { rootMargin: "-100px 0px -55% 0px", threshold: 0 },
    );
    for (const id of order) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    window.addEventListener("scroll", pick, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", pick);
    };
  }, [sections]);

  function go(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
    setCurrent(id);
  }

  return (
    <nav
      aria-label="Settings sections"
      data-testid="section-nav"
      className="sticky top-[88px] hidden w-[220px] self-start lg:block"
    >
      <ul className="space-y-1">
        {sections.map((section) => {
          const active = section.id === current;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={(e) => go(e, section.id)}
                aria-current={active ? "location" : undefined}
                data-active={active}
                className={cn(
                  "flex min-h-11 items-center border-l-2 px-4 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {section.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
