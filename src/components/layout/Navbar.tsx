"use client";

import * as React from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { MobileNav } from "@/components/layout/MobileNav";
import { NavLinks, NavLinksFallback } from "@/components/layout/NavLinks";
import { Logo } from "@/components/shared/Logo";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/utils";

/** The ONE navbar: sticky 64px glass bar (UI_BLUEPRINT §2). Inline links ≥ 768px, sheet below. */
export function Navbar({
  className,
  freshness,
}: {
  className?: string;
  freshness?: React.ReactNode;
}) {
  const [scrolled, setScrolled] = React.useState(false);
  const hydrated = useHydrated();

  React.useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    const frame = requestAnimationFrame(update); // initial value (e.g. restored scroll position)
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <header
      data-testid="navbar"
      data-hydrated={hydrated}
      data-scrolled={scrolled || undefined}
      className={cn(
        "glass sticky top-0 z-40 h-16 transition-shadow duration-200",
        scrolled && "shadow-sm",
        className,
      )}
    >
      <div className="container-wide flex h-full items-center justify-between gap-4">
        <Link href="/" aria-label="Screener — dashboard" className="rounded-md">
          <Logo size={28} />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {/* usePathname needs a Suspense boundary under Cache Components (Next 16). */}
          <nav aria-label="Main">
            <React.Suspense fallback={<NavLinksFallback />}>
              <NavLinks />
            </React.Suspense>
          </nav>
          {freshness ? <div className="mr-1 ml-2 hidden lg:block">{freshness}</div> : null}
          <span aria-hidden="true" className="mx-2 h-6 w-px bg-border-strong" />
          <LogoutButton variant="icon" />
        </div>

        <React.Suspense fallback={<span className="size-11 md:hidden" />}>
          <MobileNav freshness={freshness} />
        </React.Suspense>
      </div>
    </header>
  );
}
