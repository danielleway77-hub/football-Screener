"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SignalLostIllustration } from "@/components/illustrations";
import { ErrorState } from "@/components/states/ErrorState";

/** Shown instead of the list when loading runs failed; the page header stays. */
export function RunsError() {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  return (
    <ErrorState
      illustration={<SignalLostIllustration size={160} />}
      title="Couldn't load runs"
      message="Check your connection and try again."
      onRetry={() => startTransition(() => router.refresh())}
    />
  );
}
