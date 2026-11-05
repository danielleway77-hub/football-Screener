"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { isActivePath, NAV_LINKS } from "@/lib/nav";
import { cn } from "@/lib/utils";

const linkClass =
  "relative inline-flex h-10 items-center gap-2 rounded-md px-3.5 text-[0.9375rem] font-medium transition-colors";

/** Static, non-interactive-state version used as the Suspense fallback (no pathname needed). */
export function NavLinksFallback() {
  return (
    <ul className="flex items-center gap-1">
      {NAV_LINKS.map(({ href, label, icon: Icon }) => (
        <li key={href}>
          <span className={cn(linkClass, "text-muted-foreground")}>
            <Icon className="size-[18px]" aria-hidden="true" />
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function NavLinks() {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <LayoutGroup id="main-nav">
      <ul className="flex items-center gap-1">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  linkClass,
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-[18px]", active && "text-primary")} aria-hidden="true" />
                {label}
                {active ? (
                  <motion.span
                    layoutId="nav-pill"
                    aria-hidden="true"
                    className="absolute inset-x-3.5 -bottom-px h-0.5 rounded-full bg-primary"
                    transition={
                      reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }
                    }
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </LayoutGroup>
  );
}
