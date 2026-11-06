"use client";

import * as React from "react";
import { Callout } from "@/components/shared/Callout";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { HelperText } from "@/components/shared/HelperText";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export type RescreenResult = { changed: number; qualifying: number };

type MaintenanceCardProps = {
  storedCount: number;
  high: number;
  low: number;
  result: RescreenResult | null;
  /** True while the form holds edits that are not saved: the re-screen uses SAVED thresholds. */
  unsaved: boolean;
  /** Runs the re-screen; may throw (the dialog shows the message). */
  onRescreen: () => Promise<void>;
};

/** "Re-screen stored matches with the saved thresholds" → confirm → POST /api/settings/rescreen. */
export function MaintenanceCard({
  storedCount,
  high,
  low,
  result,
  unsaved,
  onRescreen,
}: MaintenanceCardProps) {
  const online = useOnlineStatus();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <p className="text-body-sm text-muted-foreground">
        Apply your current thresholds to matches already stored. Saving new thresholds does this for
        you; use this if an update was running at the time.
      </p>
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOpen(true)}
          disabled={!online}
          className="max-sm:w-full"
        >
          Re-screen stored matches
        </Button>
        {online ? null : <HelperText>You&apos;re offline. Reconnect to re-screen.</HelperText>}
        {unsaved ? (
          <HelperText>Unsaved threshold edits are not used. Save them first.</HelperText>
        ) : null}
      </div>
      {result ? (
        <Callout tone="positive" data-testid="rescreen-result">
          <strong>{result.changed}</strong> changed · <strong>{result.qualifying}</strong> now
          qualify.
        </Callout>
      ) : null}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Re-screen ${storedCount} stored ${storedCount === 1 ? "match" : "matches"} with ${high}% / ${low}%?`}
        description="Every stored match is checked again against the saved thresholds. Nothing is deleted."
        confirmLabel="Re-screen"
        onConfirm={onRescreen}
      />
    </div>
  );
}
