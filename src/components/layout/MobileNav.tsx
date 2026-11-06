"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon, MenuIcon, XIcon } from "lucide-react";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { isActivePath, NAV_LINKS } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** Phone navigation (< 768px): hamburger → right-hand sheet. Replaces the inline links. */
export function MobileNav({
  className,
  freshness,
}: {
  className?: string;
  freshness?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Close whenever the route changes (derive state during render; no effect needed).
  const [lastPath, setLastPath] = React.useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          aria-expanded={open}
          className={cn("md:hidden", className)}
        >
          <MenuIcon className="size-[22px]" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[min(88vw,360px)] gap-0 p-0 data-[side=right]:sm:max-w-none"
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Main navigation</SheetDescription>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-hairline px-4">
          <Logo />
          <SheetClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close menu">
              <XIcon className="size-[22px]" aria-hidden="true" />
            </Button>
          </SheetClose>
        </div>
        {freshness ? <div className="border-b border-hairline px-4 py-3">{freshness}</div> : null}
        <nav aria-label="Main" className="flex-1 overflow-y-auto overscroll-contain">
          <ul>
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <li key={href} className="border-b border-hairline">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-14 items-center gap-3.5 px-4 text-[1.0625rem] font-semibold transition-colors",
                      active ? "text-primary" : "text-foreground hover:bg-white/5",
                    )}
                  >
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 w-[3px] bg-primary"
                      />
                    ) : null}
                    <Icon className="size-[22px]" aria-hidden="true" />
                    <span className="flex-1">{label}</span>
                    <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <LogoutButton variant="row" onDone={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
