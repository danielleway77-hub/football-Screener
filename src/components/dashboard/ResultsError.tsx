"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SignalLostIllustration } from "@/components/illustrations";
import { ErrorState } from "@/components/states/ErrorState";

/** Shown in place of the results when loading them failed; header and run panel stay visible. */
export function ResultsError() {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  return (
    <ErrorState
      illustration={<SignalLostIllustration size={160} />}
      title="Couldn't load matches"
      message="Check your connection and try again."
      onRetry={() => startTransition(() => router.refresh())}
    />
  );
}
