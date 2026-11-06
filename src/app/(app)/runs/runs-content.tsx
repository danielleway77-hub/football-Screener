import Link from "next/link";
import { HistoryIcon } from "lucide-react";
import { RunsError } from "@/components/runs/RunsError";
import { AppErrorBoundary } from "@/components/states/AppErrorBoundary";
import { RunsList } from "@/components/runs/RunsList";
import { RunsToolbar } from "@/components/runs/RunsToolbar";
import { Pagination } from "@/components/shared/Pagination";
import { EmptyState } from "@/components/states/EmptyState";
import { Button } from "@/components/ui/button";
import { parseDetails, type RunRow } from "@/lib/run-view";
import { parseRunsParams, runsHref } from "@/lib/schemas/runs";
import type { RunRecord } from "@/server/repositories/types";
import { listRunsPage } from "@/server/services/run-service";
import { getSettings } from "@/server/services/settings-service";

type Search = Promise<Record<string, string | string[] | undefined>>;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Server record → plain serializable row for the client list. */
export function toRunRow(r: RunRecord): RunRow {
  return {
    id: r.id,
    trigger: r.trigger,
    provider: r.provider,
    status: r.status,
    startedAt: r.startedAt.toISOString(),
    finishedAt: iso(r.finishedAt),
    windowFrom: iso(r.windowFrom),
    windowTo: iso(r.windowTo),
    scanned: r.scanned,
    qualified: r.qualified,
    failedCount: r.failedCount,
    error: r.error,
    details: parseDetails(r.details),
  };
}

/** Runs list: all data is read at request time inside Suspense (Cache Components). */
export async function RunsContent({ searchParams }: { searchParams: Search }) {
  const raw = await searchParams;
  const params = parseRunsParams(raw);
  const now = new Date();

  let data;
  let timezone: string;
  let accessMode: string;
  try {
    // Dev-only hook for the error-state tests: `?__error=list`.
    if (process.env.NODE_ENV !== "production" && raw.__error === "list") {
      throw new Error("Forced list error");
    }
    const settings = await getSettings();
    timezone = settings.timezone;
    accessMode = settings.accessMode;
    data = await listRunsPage(params, now);
  } catch (error) {
    console.error("Runs list failed:", error instanceof Error ? error.message : "unknown");
    return <RunsError />;
  }

  const filtered = params.status !== null || params.showSkipped;
  const toolbar = <RunsToolbar status={params.status} showSkipped={params.showSkipped} />;

  if (data.total === 0) {
    return (
      <div className="space-y-6">
        {toolbar}
        {filtered ? (
          <EmptyState
            icon={HistoryIcon}
            title="No runs match these filters"
            description="Try another status, or clear the filters to see every run."
            actions={
              <Button asChild variant="secondary">
                <Link href="/runs">Clear filters</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={HistoryIcon}
            title="No runs yet"
            description="Runs appear here after the first check or import."
            actions={
              <Button asChild>
                <Link href={accessMode === "official_api" ? "/" : "/import"}>
                  {accessMode === "official_api" ? "Go to dashboard" : "Import data"}
                </Link>
              </Button>
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toolbar}
      <AppErrorBoundary>
        <RunsList rows={data.items.map(toRunRow)} timezone={timezone} nowIso={now.toISOString()} />
      </AppErrorBoundary>
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        hrefFor={(page) => runsHref({ ...params, page })}
      />
    </div>
  );
}
