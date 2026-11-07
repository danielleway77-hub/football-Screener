import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/shared/HelperText";
import { cn } from "@/lib/utils";

export type PagerTarget = { href: string; label: string } | null;

type MatchPagerProps = {
  previous: PagerTarget;
  next: PagerTarget;
  className?: string;
};

function Cell({
  target,
  direction,
  endText,
}: {
  target: PagerTarget;
  direction: "previous" | "next";
  endText: string;
}) {
  const isPrev = direction === "previous";
  const content = isPrev ? (
    <>
      <ChevronLeftIcon
        aria-hidden="true"
        className="transition-transform group-hover/pager:-translate-x-0.5 motion-reduce:transition-none"
      />
      Previous
    </>
  ) : (
    <>
      Next
      <ChevronRightIcon
        aria-hidden="true"
        className="transition-transform group-hover/pager:translate-x-0.5 motion-reduce:transition-none"
      />
    </>
  );
  const common = "group/pager w-full border-border-control md:h-10 md:w-auto md:border-transparent";
  return (
    <div className={cn("min-w-0", isPrev ? "md:text-right" : "md:text-right")}>
      {target ? (
        <Button asChild variant="ghost" className={common} data-testid={`pager-${direction}`}>
          <Link
            href={target.href}
            title={target.label}
            aria-label={`${isPrev ? "Previous" : "Next"} match: ${target.label}`}
          >
            {content}
          </Link>
        </Button>
      ) : (
        <>
          <Button
            variant="ghost"
            disabled
            className={common}
            data-testid={`pager-${direction}`}
            aria-describedby={`pager-${direction}-end`}
          >
            {content}
          </Button>
          <HelperText
            id={`pager-${direction}-end`}
            data-testid={`pager-${direction}-end`}
            className="justify-center md:justify-end"
          >
            {endText}
          </HelperText>
        </>
      )}
    </div>
  );
}

/**
 * Previous/next qualifying match. One DOM element: the page grid places it beside the back link at
 * >= 768px and at the very bottom on phones (two 44px buttons, 50% each). A missing side is a disabled
 * button plus visible text (never a tooltip).
 */
export function MatchPager({ previous, next, className }: MatchPagerProps) {
  return (
    <nav
      aria-label="Match navigation"
      data-testid="match-pager"
      className={cn("grid grid-cols-2 gap-3 md:flex md:items-start md:gap-2", className)}
    >
      <Cell target={previous} direction="previous" endText="This is the first qualifying match." />
      <Cell target={next} direction="next" endText="This is the last qualifying match." />
    </nav>
  );
}
