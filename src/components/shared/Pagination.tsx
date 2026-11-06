import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PaginationProps = {
  page: number;
  totalPages: number;
  /** URL for a page number (links keep pagination in the address bar and work without JS). */
  hrefFor: (page: number) => string;
  className?: string;
};

/** 1 … 4 5 [6] 7 8 … 20 — numbers around the current page with ellipses. */
export function pageWindow(page: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (page >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => set.add(n));
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1]! > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

const base =
  "inline-flex items-center justify-center gap-1 rounded-md border text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const idle = "border-border-control text-foreground hover:bg-white/5";
const off = "pointer-events-none border-hairline text-faint";

function Step({
  dir,
  target,
  hrefFor,
  sizeClass,
}: {
  dir: "prev" | "next";
  target: number | null;
  hrefFor: (p: number) => string;
  sizeClass: string;
}) {
  const label = dir === "prev" ? "Previous" : "Next";
  const content =
    dir === "prev" ? (
      <>
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        {label}
      </>
    ) : (
      <>
        {label}
        <ChevronRightIcon className="size-4" aria-hidden="true" />
      </>
    );
  if (target === null) {
    return (
      <span aria-disabled="true" className={cn(base, off, sizeClass)}>
        {content}
      </span>
    );
  }
  return (
    <Link href={hrefFor(target)} rel={dir} className={cn(base, idle, sizeClass)}>
      {content}
    </Link>
  );
}

/**
 * Server-renderable pager. >= 768px: Previous, numbered pages (40px), Next. < 768px: Previous / Next
 * (44px) with a "Page x of y" caption between. Hidden entirely when there is a single page.
 */
export function Pagination({ page, totalPages, hrefFor, className }: PaginationProps) {
  if (totalPages <= 1) return null;
  const prev = page > 1 ? page - 1 : null;
  const next = page < totalPages ? page + 1 : null;
  return (
    <nav aria-label="Pagination" data-testid="pagination" className={cn(className)}>
      <div className="flex items-center justify-between gap-3 md:hidden">
        <Step dir="prev" target={prev} hrefFor={hrefFor} sizeClass="h-11 min-w-28 px-3" />
        <span className="text-caption text-muted-foreground" aria-live="polite">
          Page <span className="num text-foreground">{page}</span> of{" "}
          <span className="num text-foreground">{totalPages}</span>
        </span>
        <Step dir="next" target={next} hrefFor={hrefFor} sizeClass="h-11 min-w-28 px-3" />
      </div>
      <ul className="hidden items-center justify-center gap-2 md:flex">
        <li>
          <Step dir="prev" target={prev} hrefFor={hrefFor} sizeClass="h-10 px-3" />
        </li>
        {pageWindow(page, totalPages).map((n, i) =>
          n === "gap" ? (
            <li key={`g${i}`} aria-hidden="true" className="px-1 text-faint">
              …
            </li>
          ) : (
            <li key={n}>
              <Link
                href={hrefFor(n)}
                aria-label={`Page ${n}`}
                aria-current={n === page ? "page" : undefined}
                className={cn(
                  base,
                  "num h-10 min-w-10 px-2",
                  n === page ? "border-primary-border bg-primary-soft text-primary" : idle,
                )}
              >
                {n}
              </Link>
            </li>
          ),
        )}
        <li>
          <Step dir="next" target={next} hrefFor={hrefFor} sizeClass="h-10 px-3" />
        </li>
      </ul>
    </nav>
  );
}
