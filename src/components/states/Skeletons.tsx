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
      <Skeleton className="col-span-3 h-[222px] rounded-lg md:h-32 xl:col-span-6" />
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

/** Same outer height as the real MatchCard (shared constants) and the same row structure. */
export function MatchCardSkeleton({ className }: { className?: string }) {
  return (
    <SkeletonGroup>
      <div
        className={cn(
          "surface-1 flex flex-col rounded-lg p-4 md:p-5",
          MATCH_CARD_MIN_HEIGHT_CLASS,
          className,
        )}
      >
        <div className="flex h-7 items-center justify-between">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
        <Skeleton className="mt-2 h-5 w-44" />
        <div className="mt-3 flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <div className="my-2 h-px" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-16 rounded-md" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-16 rounded-md" />
        </div>
        <div className="mt-auto pt-2.5">
          <Skeleton className="h-5 w-52" />
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

/** Mirrors DashboardContent block by block (same gaps and heights) so the swap shifts nothing. */
export function DashboardSkeleton() {
  return (
    <div data-variant="dashboard">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <HeaderSkeleton />
        </div>
        <Skeleton className="h-[177px] w-full rounded-lg md:h-40 lg:w-[400px] lg:shrink-0" />
      </div>
      <div className="mt-4">
        <StatSkeleton />
      </div>
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-full" />
          ))}
        </div>
        <div className="flex items-center gap-2 lg:gap-3">
          <Skeleton className="h-11 flex-1 lg:w-[280px] lg:flex-none" />
          <Skeleton className="size-11 md:h-11 md:w-[200px]" />
        </div>
      </div>
      <Skeleton className="mt-3 h-[17px] w-32" />
      <div className="mt-4 flex items-center gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-7 rounded-full" />
        <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-6 3xl:grid-cols-4">
        {Array.from({ length: 3 }, (_, i) => (
          <MatchCardSkeleton key={i} />
        ))}
      </div>
    </div>
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
      {variant === "dashboard" || variant === "detail" ? null : <HeaderSkeleton />}
      {variant === "dashboard" ? <DashboardSkeleton /> : null}
      {variant === "detail" ? <DetailSkeleton /> : null}
      {variant === "table" ? <TableSkeleton /> : null}
      {variant === "form" ? <FormSkeleton /> : null}
    </div>
  );
}

/** Match detail: back/pager row, hero (meta, two teams, duel track), form card and probability card. */
function DetailSkeleton() {
  return (
    <SkeletonGroup label="Loading match…" className="space-y-6">
      <div data-testid="header-skeleton" className="flex items-center justify-between">
        <Skeleton className="h-11 w-44" />
        <Skeleton className="hidden h-10 w-48 md:block" />
      </div>
      <div className="surface-1 space-y-6 rounded-xl p-5 md:p-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-8 w-28 rounded-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr] lg:gap-8">
          <div className="flex items-center gap-4">
            <Skeleton className="size-14 rounded-sm" />
            <Skeleton className="h-7 w-48" />
          </div>
          <Skeleton className="mx-auto h-6 w-10 rounded-full" />
          <div className="flex items-center gap-4">
            <Skeleton className="size-14 rounded-sm" />
            <Skeleton className="h-7 w-44" />
          </div>
        </div>
        <Skeleton className="mx-auto h-24 w-full max-w-[640px]" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        <Skeleton className="h-[34rem] rounded-lg lg:col-span-7" />
        <Skeleton className="h-[40rem] rounded-lg lg:col-span-5" />
      </div>
    </SkeletonGroup>
  );
}
