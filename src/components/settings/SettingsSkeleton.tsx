import { Skeleton } from "@/components/ui/skeleton";

/** Card heights mirror the real sections (measured at 1280) so the swap shifts nothing. */
const CARDS = [
  { id: "screening", h: "h-[820px] max-md:h-[900px]", rows: 5 },
  { id: "schedule", h: "h-[330px]", rows: 2 },
  { id: "access", h: "h-[520px]", rows: 3 },
  { id: "tokens", h: "h-[300px]", rows: 2 },
  { id: "security", h: "h-[520px]", rows: 3 },
  { id: "maintenance", h: "h-[250px]", rows: 2 },
] as const;

/** Settings layout skeleton: section index column + six cards with icon chip, title and field rows. */
export function SettingsSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      data-testid="skeleton"
      data-variant="settings"
      className="grid gap-8 lg:grid-cols-[220px_minmax(0,720px)]"
    >
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true" className="hidden space-y-1 lg:block">
        {CARDS.map((c) => (
          <Skeleton key={c.id} className="my-1.5 ml-4 h-4 w-24" />
        ))}
      </div>
      <div aria-hidden="true" className="flex min-w-0 flex-col gap-4 md:gap-6">
        {CARDS.map((c) => (
          <div
            key={c.id}
            className={`surface-1 flex flex-col gap-5 overflow-hidden rounded-lg p-4 md:p-6 ${c.h}`}
          >
            <div className="flex items-start gap-3">
              <Skeleton className="size-9 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-[min(100%,22rem)]" />
              </div>
            </div>
            {Array.from({ length: c.rows }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
