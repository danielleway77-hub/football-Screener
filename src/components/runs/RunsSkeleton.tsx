import { Skeleton } from "@/components/ui/skeleton";

/** Loading shape of the Runs list: toolbar, outcome strip, 56px rows (md+) or stacked cards (phone). */
export function RunsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" data-testid="skeleton" className="space-y-6">
      <span className="sr-only">Loading runs…</span>
      <div aria-hidden="true" className="contents">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
          <Skeleton className="h-11 w-full rounded-xl md:w-48" />
          <Skeleton className="h-11 w-full rounded-xl md:w-36" />
        </div>
        <div className="surface-1 flex min-h-11 items-center gap-4 rounded-lg px-4 py-2">
          <div className="flex h-6 items-end gap-[3px]">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton
                key={i}
                className="w-1.5 rounded-full"
                style={{ height: i % 3 ? 16 : 24 }}
              />
            ))}
          </div>
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="surface-1 hidden overflow-hidden rounded-lg md:block">
          <div className="flex h-11 items-center border-b border-hairline bg-subtle px-4">
            <Skeleton className="h-3 w-16" />
          </div>
          {Array.from({ length: rows }, (_, i) => (
            <div
              key={i}
              className="grid h-14 grid-cols-[22%_10%_14%_14%_9%_9%_8%_8%_6%] items-center border-b border-hairline px-4 last:border-0 max-lg:grid-cols-[26%_12%_16%_10%_10%_10%_10%_6%]"
            >
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-3 w-20 max-lg:hidden" />
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="ml-auto h-4 w-8" />
              <Skeleton className="ml-auto h-4 w-6" />
              <Skeleton className="ml-auto h-4 w-5" />
              <Skeleton className="ml-auto h-4 w-10" />
            </div>
          ))}
        </div>
        <div className="space-y-3 md:hidden">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="surface-1 rounded-lg p-4 pl-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="mt-3 h-4 w-32" />
              <div className="mt-3 grid grid-cols-3 gap-3">
                {[0, 1, 2].map((k) => (
                  <Skeleton key={k} className="h-12 w-full" />
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-11 w-24 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
