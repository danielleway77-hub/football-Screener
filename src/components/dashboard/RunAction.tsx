"use client";

import { RunButton } from "./RunButton";
import { useRunNow } from "./useRunNow";

/** "Run now" / "Update data" as a standalone action (stale banner, onboarding empty state). */
export function RunAction({
  canPull,
  variant = "secondary",
  size = "sm",
}: {
  canPull: boolean;
  variant?: "default" | "secondary";
  size?: "default" | "sm";
}) {
  const run = useRunNow();
  return <RunButton canPull={canPull} run={run} variant={variant} size={size} />;
}
