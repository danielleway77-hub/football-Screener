import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { throwIfForced } from "@/lib/dev-error";
import { BentoSummary } from "@/components/dashboard/BentoSummary";
import { DashboardNavProvider, ResultsRegion } from "@/components/dashboard/DashboardNav";
import { FilterBar } from "@/components/dashboard/MatchFilters";
import { RunAction } from "@/components/dashboard/RunAction";
import { ResultsError } from "@/components/dashboard/ResultsError";
import { AppErrorBoundary } from "@/components/states/AppErrorBoundary";
import { RunStatusPanel } from "@/components/dashboard/RunStatusPanel";
import {
  FunnelIllustration,
  FunnelSearchIllustration,
  PlugPulseIllustration,
  DocumentUploadIllustration,
  RadarIllustration,
} from "@/components/illustrations";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { DayGroup } from "@/components/dashboard/DayGroup";
import { MatchCard } from "@/components/match/MatchCard";
import { toCardData } from "./to-card-data";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { DashboardEmpty, HintChip } from "@/components/dashboard/DashboardEmpty";
import { Button } from "@/components/ui/button";
import { groupByLocalDate } from "@/lib/day-groups";
import { derivePanelState } from "@/lib/dashboard-state";
import { formatRelative, formatRunTime } from "@/lib/format";
import { matchHref } from "@/lib/match-detail";
import { parseDashboardParams } from "@/lib/schemas/dashboard";
import { getProvider } from "@/server/providers";
import type { MatchRecord, SettingRecord } from "@/server/repositories/types";
import {
  getDashboard,
  getDashboardSummary,
  getRunStats,
  type DashboardSummary,
  type RunStats,
} from "@/server/services/match-service";
import { getSettings } from "@/server/services/settings-service";

type Search = Promise<Record<string, string | string[] | undefined>>;

async function loadMatches(
  search: Search,
  settings: SettingRecord,
  tab: ReturnType<typeof parseDashboardParams>,
  now: Date,
): Promise<MatchRecord[] | null> {
  try {
    const raw = await search;
    // Dev-only hook for the error-state tests: `?__error=results`.
    if (process.env.NODE_ENV !== "production" && raw.__error === "results") {
      throw new Error("Forced results error");
    }
    return await getDashboard(
      { tab: tab.day, league: tab.q || undefined, sort: tab.sort },
      settings,
      now,
    );
  } catch (error) {
    console.error("Dashboard results failed:", error instanceof Error ? error.message : "unknown");
    return null;
  }
}

function Results({
  matches,
  settings,
  stats,
  summary,
  now,
  grouped,
  backHref,
  day,
  q,
}: {
  backHref: string;
  day: string;
  q: string;
  grouped: boolean;
  matches: MatchRecord[];
  settings: SettingRecord;
  stats: RunStats;
  summary: DashboardSummary;
  now: Date;
}) {
  const { highThreshold: high, lowThreshold: low, timezone } = settings;

  if (matches.length === 0) {
    if (!stats.usable && summary.total === 0) {
      const mode = settings.accessMode;
      return mode === "official_api" ? (
        <DashboardEmpty
          illustration={<RadarIllustration size={160} />}
          title="No matches yet"
          description="Run your first check to see matches that meet your rule."
          actions={<RunAction canPull variant="default" size="default" />}
        >
          <HintChip label="Rule" value={`above ${high}% vs below ${low}%`} />
        </DashboardEmpty>
      ) : mode === "assisted_ingest" ? (
        <DashboardEmpty
          illustration={<PlugPulseIllustration size={160} />}
          title="Waiting for your first update"
          description="Open PrediGoal, click the Screener button, and your matches appear here."
          actions={
            <Button asChild>
              <Link href="/import">How to update</Link>
            </Button>
          }
        >
          <HintChip label="Rule" value={`above ${high}% vs below ${low}%`} />
        </DashboardEmpty>
      ) : (
        <DashboardEmpty
          illustration={<DocumentUploadIllustration size={160} />}
          title="Import your first batch"
          description="Paste or upload the matches file to get started."
          actions={
            <Button asChild>
              <Link href="/import">Import data</Link>
            </Button>
          }
        >
          <HintChip label="Rule" value={`above ${high}% vs below ${low}%`} />
        </DashboardEmpty>
      );
    }
    if (summary.total === 0) {
      const at = stats.lastUpdate ? formatInTimeZone(stats.lastUpdate, timezone, "HH:mm") : "";
      return (
        <DashboardEmpty
          illustration={<FunnelIllustration size={160} />}
          title="No matches qualify right now"
          description={`${stats.scanned} scanned at ${at}. None had one team above ${high}% and the other below ${low}%.`}
          actions={
            <Button asChild variant="ghost">
              <Link href="/settings">Adjust thresholds</Link>
            </Button>
          }
        >
          <HintChip label="Scanned" value={String(stats.scanned)} />
          <HintChip label="Qualified" value="0" />
          <HintChip label="Rule" value={`above ${high}% vs below ${low}%`} />
        </DashboardEmpty>
      );
    }
    return (
      <DashboardEmpty
        illustration={<FunnelSearchIllustration size={160} />}
        title="Nothing matches these filters"
        description="Try another day or clear the league search."
        actions={
          <Button asChild variant="secondary">
            <Link href="/">Clear filters</Link>
          </Button>
        }
      >
        <HintChip label="Day" value={day} />
        {q ? <HintChip label="League" value={q} /> : null}
        <HintChip label="Qualifying in window" value={String(summary.total)} />
      </DashboardEmpty>
    );
  }

  const grid = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-6 3xl:grid-cols-4";
  const card = (m: MatchRecord, i: number) => (
    <StaggerItem key={m.id} index={i}>
      <MatchCard
        data={toCardData(m, timezone, now)}
        low={low}
        high={high}
        index={i}
        href={matchHref(m.id, backHref)}
      />
    </StaggerItem>
  );

  if (!grouped) return <Stagger className={grid}>{matches.map(card)}</Stagger>;

  // Upcoming: one section per LOCAL day, chronological; the chosen sort applies inside each day.
  const groups = groupByLocalDate(matches, timezone, now);
  return (
    <div className="space-y-8">
      {groups.map((group, gi) => {
        const start = groups.slice(0, gi).reduce((n, g) => n + g.items.length, 0);
        return (
          <DayGroup key={group.key} id={group.key} label={group.label} count={group.items.length}>
            <Stagger className={grid}>{group.items.map((m, i) => card(m, start + i))}</Stagger>
          </DayGroup>
        );
      })}
    </div>
  );
}

/** The dashboard body. Runs at request time (inside Suspense in page.tsx); all data via services. */
export async function DashboardContent({ searchParams }: { searchParams: Search }) {
  await throwIfForced(searchParams);
  const raw = await searchParams;
  const settings = await getSettings();
  const now = new Date(); // after the DB read: request time, never prerendered
  const params = parseDashboardParams(raw, settings.windowDays);
  // The detail page's Back link returns to exactly these filters ("/?day=today&q=..." or "/").
  const keep = new URLSearchParams();
  for (const key of ["day", "q", "sort"] as const) {
    const v = raw[key];
    if (typeof v === "string" && v !== "") keep.set(key, v);
  }
  const backHref = keep.size > 0 ? `/?${keep.toString()}` : "/";
  const [stats, summary, matches] = await Promise.all([
    getRunStats(settings, now),
    getDashboardSummary(settings, now),
    loadMatches(searchParams, settings, params, now),
  ]);

  const { highThreshold: high, lowThreshold: low, timezone } = settings;
  const canPull = getProvider(settings.accessMode).canPull;
  const state = derivePanelState(stats);
  const updatedText = stats.lastUpdate
    ? `Updated ${formatRunTime(stats.lastUpdate, now, timezone)} · ${formatRelative(stats.lastUpdate, now)}`
    : null;
  const runningId = stats.lastRun?.status === "RUNNING" ? stats.lastRun.id : null;
  const showing = matches?.length ?? 0;
  const grouped = params.day === "upcoming" && showing > 0;

  return (
    <>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeader
          overline="DASHBOARD"
          title="Qualifying matches"
          description={`Form above ${high}% vs below ${low}%`}
          className="min-w-0 flex-1 md:flex-col md:items-start"
        />
        <div className="w-full lg:w-[400px] lg:shrink-0">
          <AppErrorBoundary>
            <RunStatusPanel
              state={state}
              canPull={canPull}
              runningRunId={runningId}
              updatedText={updatedText}
              scanned={stats.usable?.scanned ?? 0}
              qualified={stats.usable?.qualified ?? 0}
              failedCount={stats.usable?.failedCount ?? 0}
              failedMessage={stats.lastRun?.status === "FAILED" ? stats.lastRun.error : null}
            />
          </AppErrorBoundary>
        </div>
      </div>

      <div className="mt-4">
        <BentoSummary
          total={summary.total}
          perDay={summary.perDay}
          windowDays={settings.windowDays}
          high={high}
          low={low}
          nextKickoffIso={summary.nextKickoff?.toISOString() ?? null}
          nowIso={now.toISOString()}
          timezone={timezone}
          scanned={stats.usable?.scanned ?? 0}
          updatedTime={
            stats.lastUpdate ? formatInTimeZone(stats.lastUpdate, timezone, "HH:mm") : null
          }
          updatedRelative={stats.lastUpdate ? formatRelative(stats.lastUpdate, now) : null}
          stale={stats.stale}
          showing={showing}
          q={params.q}
          sort={params.sort}
        />
      </div>

      <DashboardNavProvider params={params}>
        <FilterBar
          counts={{
            upcoming: summary.total,
            today: summary.perDay.today,
            tomorrow: summary.perDay.tomorrow,
            dayafter: summary.perDay.dayafter,
          }}
          windowDays={settings.windowDays}
          caption={
            matches
              ? `Showing ${showing} ${showing === 1 ? "match" : "matches"}${showing >= 200 && summary.total > showing ? " (the first 200; narrow the filters to see the rest)" : ""}`
              : ""
          }
        />
        <div role="tabpanel" id="results-panel" aria-labelledby={`day-tab-${params.day}`}>
          {grouped ? null : <h2 className="sr-only">Matches</h2>}
          {grouped && params.sort !== "kickoff" ? (
            <p data-testid="sort-note" className="text-caption mt-3 text-faint">
              Sorted within each day
            </p>
          ) : null}
          <div className="mt-4">
            <ResultsRegion>
              {matches ? (
                <Results
                  key={`${params.day}|${params.q}|${params.sort}`}
                  matches={matches}
                  settings={settings}
                  stats={stats}
                  summary={summary}
                  now={now}
                  grouped={grouped}
                  backHref={backHref}
                  day={params.day}
                  q={params.q}
                />
              ) : (
                <ResultsError />
              )}
            </ResultsRegion>
          </div>
        </div>
      </DashboardNavProvider>
    </>
  );
}
