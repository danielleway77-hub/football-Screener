"use client";

import * as React from "react";
import { LayoutGroup, motion } from "framer-motion";
import { ArrowUpDownIcon, SearchIcon, XIcon } from "lucide-react";
import { ScrollFade } from "@/components/shared/ScrollFade";
import { StickyBar } from "@/components/shared/StickyBar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SPRING, useMotionPrefs } from "@/lib/motion";
import { SORT_VALUES, type DashboardDay, type DashboardSort } from "@/lib/schemas/dashboard";
import { cn } from "@/lib/utils";
import { useDashboardNav } from "./DashboardNav";

export type DayCounts = { upcoming: number; today: number; tomorrow: number; dayafter: number };

const DAY_LABEL: Record<DashboardDay, string> = {
  upcoming: "Upcoming",
  today: "Today",
  tomorrow: "Tomorrow",
  dayafter: "Day after",
};
const SORT_LABEL: Record<DashboardSort, string> = {
  kickoff: "Kickoff (soonest)",
  gap: "Biggest form gap",
};
const DEBOUNCE_MS = 300;

/**
 * Accessible tablist with a sliding indicator: left/right arrows move and select, Home/End jump.
 * Counts are per day and ignore the league search.
 */
function DayTabs({ counts, windowDays }: { counts: DayCounts; windowDays: number }) {
  const { params, navigate } = useDashboardNav();
  const days = (Object.keys(DAY_LABEL) as DashboardDay[]).filter(
    (d) => d !== "dayafter" || windowDays >= 2,
  );
  const refs = React.useRef(new Map<DashboardDay, HTMLButtonElement>());
  const groupId = React.useId();
  const { reduce } = useMotionPrefs();

  function move(index: number) {
    const day = days[(index + days.length) % days.length]!;
    navigate({ day });
    refs.current.get(day)?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const at = days.indexOf(params.day);
    if (event.key === "ArrowRight") move(at + 1);
    else if (event.key === "ArrowLeft") move(at - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(days.length - 1);
    else return;
    event.preventDefault();
  }

  return (
    <ScrollFade aria-label="Day filter" className="-mx-1 px-1 md:overflow-visible">
      <LayoutGroup id={groupId}>
        <div role="tablist" aria-label="Day" onKeyDown={onKeyDown} className="flex gap-2">
          {days.map((day) => {
            const selected = day === params.day;
            return (
              <button
                key={day}
                ref={(el) => {
                  if (el) refs.current.set(day, el);
                  else refs.current.delete(day);
                }}
                type="button"
                role="tab"
                id={`day-tab-${day}`}
                aria-selected={selected}
                aria-controls="results-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => navigate({ day })}
                className={cn(
                  "relative inline-flex h-10 shrink-0 items-center gap-2 rounded-4xl px-3.5 text-[0.9375rem] font-medium whitespace-nowrap transition-colors motion-reduce:transition-none",
                  selected ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {selected ? (
                  <motion.span
                    layoutId="day-pill"
                    aria-hidden="true"
                    data-testid="day-pill"
                    className="absolute inset-0 rounded-4xl border border-primary-border bg-primary-soft"
                    transition={reduce ? { duration: 0 } : SPRING}
                  />
                ) : null}
                <span className="relative">{DAY_LABEL[day]}</span>
                <span className="num relative rounded-full bg-surface-raised px-1.5 text-xs text-foreground">
                  {counts[day]}
                </span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>
    </ScrollFade>
  );
}

/**
 * League search. >= 768px: an inline field. Phones: a 44px icon button (lime dot while a query or a
 * non-default sort is active) that slides the field over the tabs; Esc or the close button collapses it
 * and returns focus to the button. An active query keeps the field open (the URL is the truth).
 */
function SearchBox() {
  const { params, navigate } = useDashboardNav();
  const [value, setValue] = React.useState(params.q);
  const [seenQ, setSeenQ] = React.useState(params.q);
  const [expanded, setExpanded] = React.useState(params.q !== "");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const openRef = React.useRef<HTMLButtonElement>(null);
  const restoreFocus = React.useRef(false);

  // Back/forward or "Clear filters" rewrites the box.
  if (seenQ !== params.q) {
    setSeenQ(params.q);
    setValue(params.q);
  }

  React.useEffect(() => {
    if (value.trim() === params.q) return;
    const timer = setTimeout(() => navigate({ q: value.trim().slice(0, 60) }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, params.q, navigate]);

  React.useEffect(() => {
    if (expanded) {
      if (window.matchMedia("(max-width: 767px)").matches) inputRef.current?.focus();
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      openRef.current?.focus();
    }
  }, [expanded]);

  function collapse() {
    restoreFocus.current = true;
    setExpanded(false);
  }

  const active = params.q !== "" || params.sort !== "kickoff";

  return (
    <>
      <Button
        ref={openRef}
        type="button"
        variant="secondary"
        size="icon"
        aria-label="Search leagues"
        aria-expanded={expanded}
        onClick={() => setExpanded(true)}
        className="relative md:hidden"
      >
        <SearchIcon aria-hidden="true" />
        {active ? (
          <span
            role="img"
            aria-label="Filters active"
            data-testid="filters-dot"
            className="absolute top-2 right-2 size-2.5 rounded-full bg-primary ring-2 ring-surface"
          />
        ) : null}
      </Button>
      <div
        data-testid="search-field"
        data-expanded={expanded}
        className={cn(
          expanded
            ? "absolute inset-0 z-10 flex animate-in items-center gap-2 bg-canvas duration-200 slide-in-from-right-8 motion-reduce:animate-none md:static md:z-auto md:block md:animate-none md:bg-transparent"
            : "hidden md:block",
          "min-w-0 md:w-auto lg:w-[280px]",
        )}
      >
        <div className="relative min-w-0 flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-faint"
            aria-hidden="true"
          />
          <Input
            ref={inputRef}
            type="search"
            inputMode="search"
            aria-label="Filter by league"
            placeholder="Filter by league"
            maxLength={60}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && expanded) {
                e.preventDefault();
                collapse();
              }
            }}
            className="pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden"
          />
          {value ? (
            <button
              type="button"
              aria-label="Clear league filter"
              onClick={() => {
                setValue("");
                navigate({ q: "" });
                inputRef.current?.focus();
              }}
              className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Close search"
          onClick={collapse}
          className="shrink-0 md:hidden"
        >
          <XIcon aria-hidden="true" />
        </Button>
      </div>
    </>
  );
}

function SortControl() {
  const { params, navigate } = useDashboardNav();
  return (
    <>
      <div className="hidden md:block">
        <Select value={params.sort} onValueChange={(v) => navigate({ sort: v as DashboardSort })}>
          <SelectTrigger
            aria-label="Sort matches"
            className="h-11 min-w-[200px] data-[size=default]:h-11"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_VALUES.map((s) => (
              <SelectItem key={s} value={s}>
                {SORT_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="Sort matches">
              <ArrowUpDownIcon aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={params.sort}
              onValueChange={(v) => navigate({ sort: v as DashboardSort })}
            >
              {SORT_VALUES.map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  {SORT_LABEL[s]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

/**
 * Sticky filter bar (UI_BLUEPRINT §23): plain flow until it reaches the navbar, then glass with a
 * hairline. Phones show the day tabs plus search and sort icon buttons; desktop adds the
 * "Showing n matches" caption at the far right of the bar.
 */
export function FilterBar({
  counts,
  windowDays,
  caption,
}: {
  counts: DayCounts;
  windowDays: number;
  caption: string;
}) {
  return (
    <>
      <StickyBar className="-mx-4 mt-6 px-4 md:-mx-6 md:px-6 xl:-mx-8 xl:px-8">
        <div
          data-testid="match-filters"
          className="relative flex min-h-12 items-center gap-2 lg:gap-3"
        >
          <div className="min-w-0 flex-1">
            <DayTabs counts={counts} windowDays={windowDays} />
          </div>
          <SearchBox />
          <SortControl />
        </div>
        <p
          aria-live="polite"
          data-testid="results-caption"
          className="text-caption num mt-1 hidden text-right text-muted-foreground md:block"
        >
          {caption}
        </p>
      </StickyBar>
      <p
        aria-live="polite"
        data-testid="results-caption"
        className="text-caption num mt-3 text-muted-foreground md:hidden"
      >
        {caption}
      </p>
    </>
  );
}
