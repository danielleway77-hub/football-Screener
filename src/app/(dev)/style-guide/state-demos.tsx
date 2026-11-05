"use client";

import * as React from "react";
import Link from "next/link";
import { InboxIcon } from "lucide-react";
import { MATCH_CARD_MIN_HEIGHT_CLASS } from "@/components/match/dimensions";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { OfflineBanner } from "@/components/states/OfflineBanner";
import { MatchCardSkeleton, PageSkeleton } from "@/components/states/Skeletons";
import { SlowHint } from "@/components/states/SlowHint";
import { StaleBanner } from "@/components/states/StaleBanner";
import { Button } from "@/components/ui/button";
import { useSlowRequest } from "@/hooks/useSlowRequest";
import { cn } from "@/lib/utils";

/** Specimens for Step 3.2 (state kit). Every state can be forced here and is covered by e2e tests. */
export function StateKitDemos() {
  const [loading, setLoading] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const slow = useSlowRequest(pending);
  const [attempts, setAttempts] = React.useState(0);

  async function retry() {
    await new Promise((resolve) => setTimeout(resolve, 400));
    setAttempts((n) => n + 1);
  }

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <h3 className="text-overline text-muted-foreground">
          Skeleton ⇄ content (no layout shift)
        </h3>
        <Button variant="secondary" size="sm" onClick={() => setLoading((v) => !v)}>
          {loading ? "Show content" : "Show skeleton"}
        </Button>
        <div className="max-w-md" data-testid="swap-area">
          {loading ? (
            <MatchCardSkeleton />
          ) : (
            <div
              data-testid="swap-content"
              className={cn("surface-1 rounded-lg p-5", MATCH_CARD_MIN_HEIGHT_CLASS)}
            >
              <p className="text-h4">Sporting Cristal – FC Cajamarca</p>
              <p className="text-body-sm mt-2 text-muted-foreground">
                Real content has the same minimum height as its skeleton.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-overline text-muted-foreground">Page skeletons</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {(["dashboard", "detail", "table", "form"] as const).map((variant) => (
            <div
              key={variant}
              className="max-h-72 overflow-hidden rounded-md border border-hairline p-3"
            >
              <p className="text-caption mb-2 text-faint">{variant}</p>
              <PageSkeleton variant={variant} className="!px-0" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-overline text-muted-foreground">Empty and error states</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="surface-1 rounded-lg" data-testid="demo-empty">
            <EmptyState
              icon={InboxIcon}
              title="No matches yet"
              description="Run your first check to see matches that meet your rule."
              actions={<Button>Update data</Button>}
            />
          </div>
          <div className="surface-1 rounded-lg" data-testid="demo-error">
            <ErrorState
              title="Couldn't load matches"
              message="Check your connection and try again."
              code="TIMEOUT"
              onRetry={retry}
            />
            <p className="text-caption num pb-4 text-center text-faint" data-testid="retry-count">
              retries: {attempts}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-overline text-muted-foreground">Banners</h3>
        <div className="overflow-hidden rounded-md border border-hairline">
          <StaleBanner hours={31} action={<Button size="xs">Update data</Button>} />
        </div>
        <p className="text-body-sm text-muted-foreground">
          The offline banner below is live: switch DevTools → Network → Offline to see it.
        </p>
        <div
          className="overflow-hidden rounded-md border border-hairline"
          data-testid="offline-demo"
        >
          <OfflineBanner />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-overline text-muted-foreground">Slow request hint (after 3 s)</h3>
        <Button
          variant="secondary"
          loading={pending}
          onClick={() => {
            setPending(true);
            setTimeout(() => setPending(false), 4500);
          }}
        >
          Start a slow request
        </Button>
        <SlowHint active={slow} />
      </div>

      <div className="space-y-3">
        <h3 className="text-overline text-muted-foreground">Route progress bar</h3>
        <p className="text-body-sm text-muted-foreground">
          Click the link: a 2px lime bar runs along the top while the next page loads.
        </p>
        <Button asChild variant="secondary" size="sm">
          <Link href="/style-guide/shell">Navigate to the shell demo</Link>
        </Button>
      </div>
    </div>
  );
}
