"use client";

import * as React from "react";
import { RefreshCwIcon, XCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title?: string;
  /** Friendly text. Never pass raw error messages or stack traces. */
  message?: string;
  /** Short machine code (e.g. "TIMEOUT"); shown only inside "Technical details". */
  code?: string;
  /** Retry handler; may be async. The button shows a loading state and ignores double clicks. */
  onRetry?: () => Promise<unknown> | void;
  illustration?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
};

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't complete that. Try again.",
  code,
  onRetry,
  illustration,
  secondaryAction,
  className,
}: ErrorStateProps) {
  const [retrying, setRetrying] = React.useState(false);
  const busy = React.useRef(false);

  async function retry() {
    if (!onRetry || busy.current) return; // idempotent: ignore double clicks
    busy.current = true;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      busy.current = false;
      setRetrying(false);
    }
  }

  return (
    <div
      role="alert"
      data-testid="error-state"
      className={cn(
        "mx-auto flex max-w-[480px] flex-col items-center px-6 py-12 text-center",
        className,
      )}
    >
      {illustration ? (
        <div className="mb-5 text-faint">{illustration}</div>
      ) : (
        <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-negative-soft text-negative">
          <XCircleIcon className="size-7" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-h3">{title}</h3>
      <p className="text-body-sm mt-2 text-muted-foreground">{message}</p>

      {onRetry || secondaryAction ? (
        <div className="mt-6 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          {onRetry ? (
            <Button onClick={retry} loading={retrying} className="max-sm:w-full">
              <RefreshCwIcon aria-hidden="true" />
              Try again
            </Button>
          ) : null}
          {secondaryAction}
        </div>
      ) : null}

      {code ? (
        <details className="mt-6 text-xs text-faint">
          <summary className="cursor-pointer select-none">Technical details</summary>
          <p className="num mt-2">Error code: {code}</p>
        </details>
      ) : null}
    </div>
  );
}
