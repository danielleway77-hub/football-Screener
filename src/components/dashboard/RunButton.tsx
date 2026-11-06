"use client";

import Link from "next/link";
import { RefreshCwIcon, UploadCloudIcon } from "lucide-react";
import { HelperText } from "@/components/shared/HelperText";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cn } from "@/lib/utils";
import type { RunNowState } from "./useRunNow";

type RunButtonProps = {
  /** `official_api` pulls ("Run now"); the other modes link to the import page ("Update data"). */
  canPull: boolean;
  run: RunNowState;
  variant?: "default" | "secondary";
  size?: "default" | "sm";
  className?: string;
};

/** Primary action of the dashboard: Run now (mode A) or Update data (B/C). Disabled states say why. */
export function RunButton({
  canPull,
  run,
  variant = "default",
  size = "default",
  className,
}: RunButtonProps) {
  const online = useOnlineStatus();
  if (!canPull) {
    return (
      <Button asChild variant={variant} size={size} className={className}>
        <Link href="/import">
          <UploadCloudIcon aria-hidden="true" />
          Update data
        </Link>
      </Button>
    );
  }
  return (
    <div className={cn("flex flex-col", className)}>
      <Button
        variant={variant}
        size={size}
        disabled={run.running || !online}
        onClick={() => void run.start()}
        className="w-full md:w-auto"
      >
        <RefreshCwIcon
          className={run.running ? "animate-spin motion-reduce:animate-none" : undefined}
          aria-hidden="true"
        />
        {run.running ? "Running…" : "Run now"}
      </Button>
      {!online ? <HelperText>You&apos;re offline. Reconnect to run a check.</HelperText> : null}
      {run.error && online ? <HelperText role="alert">{run.error}</HelperText> : null}
    </div>
  );
}
