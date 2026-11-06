"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MatchCardSkeleton } from "@/components/states/Skeletons";
import { dashboardHref, type DashboardParams } from "@/lib/schemas/dashboard";
import { cn } from "@/lib/utils";

type Ctx = {
  params: DashboardParams;
  pending: boolean;
  /** Merge `patch` into the URL (router.replace, no scroll). The URL is the source of truth. */
  navigate: (patch: Partial<DashboardParams>) => void;
};

const DashboardNavContext = React.createContext<Ctx | null>(null);

export function useDashboardNav(): Ctx {
  const ctx = React.useContext(DashboardNavContext);
  if (!ctx) throw new Error("useDashboardNav must be used inside <DashboardNavProvider>");
  return ctx;
}

/** Shares the validated URL params and the "navigation pending" state between filters and results. */
export function DashboardNavProvider({
  params,
  children,
}: {
  params: DashboardParams;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const navigate = React.useCallback(
    (patch: Partial<DashboardParams>) => {
      const next = { ...params, ...patch };
      if (next.day === params.day && next.q === params.q && next.sort === params.sort) return;
      startTransition(() => router.replace(dashboardHref(next), { scroll: false }));
    },
    [params, router],
  );

  const value = React.useMemo(() => ({ params, pending, navigate }), [params, pending, navigate]);
  return <DashboardNavContext.Provider value={value}>{children}</DashboardNavContext.Provider>;
}

/**
 * Wraps the results: dims to 0.4 immediately on a filter change; when the request takes longer than
 * 300 ms (flicker guard) three skeleton cards replace it; cross-fades back in 200 ms.
 */
export function ResultsRegion({ children }: { children: React.ReactNode }) {
  const { pending } = useDashboardNav();
  const [slow, setSlow] = React.useState(false);
  const regionRef = React.useRef<HTMLDivElement>(null);
  const wasPending = React.useRef(false);

  // When a filter change finishes while the filter bar is stuck, bring the top of the results just
  // under the bar; when it is not stuck, never scroll.
  React.useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }
    if (!wasPending.current) return;
    wasPending.current = false;
    const bar = document.querySelector<HTMLElement>(
      '[data-testid="sticky-bar"][data-stuck="true"]',
    );
    const region = regionRef.current;
    if (!bar || !region) return;
    const target = region.getBoundingClientRect().top + window.scrollY - 64 - bar.offsetHeight - 16;
    if (window.scrollY > target) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: Math.max(target, 0), behavior: reduce ? "auto" : "smooth" });
    }
  }, [pending]);

  React.useEffect(() => {
    if (!pending) {
      const reset = setTimeout(() => setSlow(false), 0);
      return () => clearTimeout(reset);
    }
    const timer = setTimeout(() => setSlow(true), 300);
    return () => clearTimeout(timer);
  }, [pending]);

  return (
    <div
      ref={regionRef}
      data-testid="results-region"
      data-pending={pending || undefined}
      aria-busy={pending || undefined}
      className={cn(
        "transition-opacity duration-200 motion-reduce:transition-none",
        pending && "opacity-40",
      )}
    >
      {pending && slow ? (
        <div
          data-testid="results-skeleton"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-6 3xl:grid-cols-4"
        >
          {Array.from({ length: 3 }, (_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
