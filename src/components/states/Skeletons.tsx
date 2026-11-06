import { MATCH_CARD_MIN_HEIGHT_CLASS } from "@/components/match/dimensions";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading placeholders that MIRROR the final layouts (heights come from shared constants) so content
 * replaces them with no layout shift (UI_BLUEPRINT §13). Each group announces "Loading…" once; the
 * shapes themselves are aria-hidden.
 */
function SkeletonGroup({
  className,
  children,
  label = "Loading…",
}: {
  className?: string;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <div role="status" aria-busy="true" className={className} data-testid="skeleton">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="contents">
        {children}
      </div>
    </div>
  );
}

/** Page header block: overline + h1 + description (same height as SectionHeader). */
export function HeaderSkeleton() {
  return (
    <div className="space-y-2" data-testid="header-skeleton">
      <Skeleton className="h-[0.9rem] w-20" />
      <Skeleton className="h-[calc(clamp(1.75rem,3.2vw,2.5rem)*1.15)] w-[min(70%,16rem)]" />
      <Skeleton className="h-[1.3125rem] w-[min(100%,22rem)]" />
    </div>
  );
}

/** Dashboard summary: one hero tile + three small tiles (bento, UI_BLUEPRINT §22). */
export function StatSkeleton({ className }: { className?: string }) {
  return (
    <SkeletonGroup className={cn("grid grid-cols-3 gap-3 md:gap-4 xl:grid-cols-12", className)}>
      <Skeleton className="col-span-3 h-28 rounded-lg md:h-32 xl:col-span-6" />
      <Skeleton className="h-[88px] rounded-lg md:h-32 xl:col-span-2" />
      <Skeleton className="h-[88px] rounded-lg md:h-32 xl:col-span-2" />
      <Skeleton className="h-[88px] rounded-lg md:h-32 xl:col-span-2" />
    </SkeletonGroup>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <SkeletonGroup className={className}>
      <Skeleton className="h-40 w-full rounded-lg" />
    </SkeletonGroup>
  );
}

/** Same outer height as the real MatchCard (shared constant). */
export function MatchCardSkeleton({ className }: { className?: string }) {
  return (
    <SkeletonGroup>
      <div
        className={cn(
          "surface-1 flex flex-col gap-3 rounded-lg p-4 md:p-5",
          MATCH_CARD_MIN_HEIGHT_CLASS,
          className,
        )}
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <div className="mt-auto grid grid-cols-3 gap-2">
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-16 rounded-md" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-16 rounded-md" />
        </div>
      </div>
    </SkeletonGroup>
  );
}

export function TableSkeleton({ rows = 8, className }: { rows?: number; className?: string }) {
  return (
    <SkeletonGroup className={className}>
      {/* Desktop: header row 44px + body rows 56px */}
      <div className="surface-1 hidden overflow-hidden rounded-lg md:block">
        <Skeleton className="h-11 w-full rounded-none" />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="border-t border-hairline p-2">
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      {/* Phone: stacked cards of 132px */}
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[132px] w-full rounded-lg" />
        ))}
      </div>
    </SkeletonGroup>
  );
}

export function FormSkeleton({ className }: { className?: string }) {
  return (
    <SkeletonGroup className={cn("space-y-4", className)}>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="surface-1 space-y-4 rounded-lg p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </SkeletonGroup>
  );
}

type PageSkeletonProps = {
  variant: "dashboard" | "detail" | "table" | "form";
  className?: string;
};

/** Whole-page skeleton for `loading.tsx`. The header block matches the real page header. */
export function PageSkeleton({ variant, className }: PageSkeletonProps) {
  return (
    <div className={cn("container-wide space-y-6", className)} data-variant={variant}>
      <HeaderSkeleton />
      {variant === "dashboard" ? (
        <>
          <Skeleton className="h-32 w-full rounded-lg lg:ml-auto lg:w-[400px]" />
          <StatSkeleton />
          <div className="flex gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-11 w-full md:w-72" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-6 3xl:grid-cols-4">
            {Array.from({ length: 3 }, (_, i) => (
              <MatchCardSkeleton key={i} />
            ))}
          </div>
        </>
      ) : null}
      {variant === "detail" ? (
        <>
          <Skeleton className="h-11 w-48" />
          <Skeleton className="h-40 w-full rounded-xl md:h-52" />
          <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
            <Skeleton className="h-80 rounded-lg lg:col-span-7" />
            <Skeleton className="h-80 rounded-lg lg:col-span-5" />
          </div>
        </>
      ) : null}
      {variant === "table" ? <TableSkeleton /> : null}
      {variant === "form" ? <FormSkeleton /> : null}
    </div>
  );
}
