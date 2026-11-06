"use client";

import * as React from "react";
import { ArrowUpDownIcon, SearchIcon, XIcon } from "lucide-react";
import { ScrollFade } from "@/components/shared/ScrollFade";
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

/** Accessible tablist: ←/→ move and select, Home/End jump; arrow keys never leave the tablist. */
function DayTabs({ counts, windowDays }: { counts: DayCounts; windowDays: number }) {
  const { params, navigate } = useDashboardNav();
  const days = (Object.keys(DAY_LABEL) as DashboardDay[]).filter(
    (d) => d !== "dayafter" || windowDays >= 2,
  );
  const refs = React.useRef(new Map<DashboardDay, HTMLButtonElement>());

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
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-4xl border px-3.5 text-[0.9375rem] font-medium whitespace-nowrap transition-colors",
                selected
                  ? "border-primary-border bg-primary-soft text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {DAY_LABEL[day]}
              <span className="num rounded-full bg-surface-raised px-1.5 text-xs text-foreground">
                {counts[day]}
              </span>
            </button>
          );
        })}
      </div>
    </ScrollFade>
  );
}

function SearchBox() {
  const { params, navigate } = useDashboardNav();
  const [value, setValue] = React.useState(params.q);
  const [seenQ, setSeenQ] = React.useState(params.q);

  // The URL is the source of truth: back/forward or "Clear filters" rewrites the box.
  if (seenQ !== params.q) {
    setSeenQ(params.q);
    setValue(params.q);
  }

  React.useEffect(() => {
    if (value.trim() === params.q) return;
    const timer = setTimeout(() => navigate({ q: value.trim().slice(0, 60) }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, params.q, navigate]);

  return (
    <div className="relative min-w-0 flex-1 lg:w-[280px] lg:flex-none">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-faint"
        aria-hidden="true"
      />
      <Input
        type="search"
        inputMode="search"
        aria-label="Filter by league"
        placeholder="Filter by league"
        maxLength={60}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear league filter"
          onClick={() => {
            setValue("");
            navigate({ q: "" });
          }}
          className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
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

/** Day tabs, league search and sort. Every change goes to the URL (router.replace, no scroll). */
export function MatchFilters({ counts, windowDays }: { counts: DayCounts; windowDays: number }) {
  return (
    <div
      data-testid="match-filters"
      className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
    >
      <DayTabs counts={counts} windowDays={windowDays} />
      <div className="flex items-center gap-2 lg:gap-3">
        <SearchBox />
        <SortControl />
      </div>
    </div>
  );
}
