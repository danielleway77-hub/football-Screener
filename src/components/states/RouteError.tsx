"use client";

import * as React from "react";
import Link from "next/link";
import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import { illustrationFor } from "@/components/illustrations";
import { Reveal } from "@/components/motion/Reveal";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

type RouteErrorProps = {
  error: unknown;
  /** Next 16: re-fetches and re-renders the segment (the old `reset` prop is not used). */
  retry: () => void;
};

/** `error.digest` links an error to the server logs; never show the message or a stack trace. */
function digestOf(error: unknown): string {
  if (error instanceof Error) {
    const digest = (error as Error & { digest?: string }).digest;
    if (digest) return digest;
  }
  return "UNKNOWN";
}

/**
 * The shared body of every route-level `error.tsx` (one implementation; each route file only
 * re-exports it). Friendly text, retry that works, a way home, and the digest in "Technical details".
 */
export function RouteError({ error, retry }: RouteErrorProps) {
  const online = useOnlineStatus();
  React.useEffect(() => {
    // Log the message for the developer console only; users never see it.
    console.error(
      "Route error:",
      error instanceof Error ? error.message : "non-Error value thrown",
    );
  }, [error]);

  return (
    <Reveal className="container-wide">
      <ErrorState
        title={online ? undefined : "You're offline"}
        message={online ? undefined : "Check your connection, then try again. Your data is safe."}
        code={digestOf(error)}
        illustration={illustrationFor("error")}
        onRetry={retry}
        secondaryAction={
          <Button asChild variant="ghost" className="max-sm:w-full">
            <Link href="/">Dashboard</Link>
          </Button>
        }
      />
    </Reveal>
  );
}
