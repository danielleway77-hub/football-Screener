import Link from "next/link";
import { CountUp } from "@/components/motion/CountUp";
import { SpotlightCard } from "@/components/motion/SpotlightCard";
import { dashboardHref, type DashboardDay } from "@/lib/schemas/dashboard";
import { cn } from "@/lib/utils";
import { NextKickoff } from "./NextKickoff";

export type BentoProps = {
  /** Qualifying matches that have not kicked off yet (all days). */
  total: number;
  perDay: Record<"today" | "tomorrow" | "dayafter", number>;
  windowDays: number;
  high: number;
  low: number;
  nextKickoffIso: string | null;
  nowIso: string;
  timezone: string;
  scanned: number;
  /** "06:58" or null when there is no data yet. */
  updatedTime: string | null;
  updatedRelative: string | null;
  stale: boolean;
  showing: number;
  /** Current filters, kept when a day chip is clicked. */
  q: string;
  sort: "kickoff" | "gap";
};

const DAY_CHIPS: { day: Exclude<DashboardDay, "upcoming">; label: string }[] = [
  { day: "today", label: "Today" },
  { day: "tomorrow", label: "Tomorrow" },
  { day: "dayafter", label: "Day after" },
];

export function BentoTile({
  label,
  value,
  caption,
  warn,
  testId,
}: {
  label: string;
  value: React.ReactNode;
  caption: string;
  warn?: boolean;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="surface-2 flex h-[88px] min-w-0 flex-col justify-between rounded-lg p-3 md:h-32 md:p-4 xl:col-span-2"
    >
      <p className="text-overline truncate text-muted-foreground">{label}</p>
      <p
        className={cn(
          "num text-xl leading-none font-semibold md:text-[28px]",
          warn ? "text-warning" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="text-caption truncate text-faint">{caption}</p>
    </div>
  );
}

/** Dashboard summary (UI_BLUEPRINT §22): hero "Qualifying now" + three tiles, 12-column grid. */
export function BentoSummary(p: BentoProps) {
  const active = p.total > 0;
  const chips = DAY_CHIPS.filter(
    (c) => (c.day !== "dayafter" || p.windowDays >= 2) && p.perDay[c.day] > 0,
  );
  return (
    <section
      aria-label="Summary"
      data-testid="bento"
      className="grid grid-cols-3 gap-3 md:gap-4 xl:grid-cols-12"
    >
      <SpotlightCard
        className={cn(
          "surface-2 col-span-3 min-h-28 rounded-lg p-4 md:min-h-32 md:p-5 xl:col-span-6",
          active &&
            "bg-[radial-gradient(circle_at_top_left,color-mix(in_oklab,var(--primary)_8%,transparent),transparent_60%)] accent-border",
        )}
      >
        <div
          data-testid="bento-hero"
          data-active={active}
          className="flex h-full items-center gap-4 md:gap-6"
        >
          <div className="shrink-0 space-y-1.5">
            <p className="text-overline text-muted-foreground">Qualifying now</p>
            <p
              data-testid="bento-count"
              className={cn(
                "num text-5xl leading-none font-semibold md:text-6xl",
                active ? "text-primary" : "text-faint",
              )}
            >
              <CountUp value={p.total} />
            </p>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            {active ? (
              <>
                <p className="text-body-sm text-muted-foreground">
                  matches meet your {p.high}% / {p.low}% rule
                </p>
                {chips.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Matches per day">
                    {chips.map((c) => (
                      <li key={c.day}>
                        <Link
                          href={dashboardHref({ day: c.day, q: p.q, sort: p.sort })}
                          className="num inline-flex h-7 items-center gap-1.5 rounded-4xl border border-hairline-strong bg-surface-raised px-2.5 text-xs text-foreground transition-colors hover:border-primary-border hover:text-primary"
                        >
                          <span className="font-sans text-muted-foreground">{c.label}</span>
                          {p.perDay[c.day]}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {p.nextKickoffIso ? (
                  <NextKickoff
                    kickoffIso={p.nextKickoffIso}
                    nowIso={p.nowIso}
                    timezone={p.timezone}
                  />
                ) : null}
              </>
            ) : (
              <p className="text-body-sm text-muted-foreground">No matches qualify right now</p>
            )}
          </div>
        </div>
      </SpotlightCard>

      <BentoTile
        testId="bento-scanned"
        label="Scanned"
        value={<CountUp value={p.scanned} />}
        caption="last check"
      />
      <BentoTile
        testId="bento-updated"
        label="Updated"
        value={p.updatedTime ?? "—"}
        caption={p.updatedRelative ?? "no data yet"}
        warn={p.stale && p.updatedTime !== null}
      />
      <BentoTile
        testId="bento-showing"
        label="Showing"
        value={<CountUp value={p.showing} />}
        caption={`of ${p.total}`}
      />
    </section>
  );
}
