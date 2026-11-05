"use client";

import * as React from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CopyButtonProps = {
  value: string;
  label?: string;
  className?: string;
};

type State = "idle" | "copied" | "failed";

/** Fallback for browsers/contexts without the async clipboard API. */
function legacyCopy(value: string): boolean {
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({ value, label = "Copy", className }: CopyButtonProps) {
  const [state, setState] = React.useState<State>("idle");
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  async function copy() {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        ok = true;
      } else {
        ok = legacyCopy(value);
      }
    } catch {
      ok = legacyCopy(value);
    }
    setState(ok ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={copy}
        className={cn("min-w-[5.5rem]", className)}
        aria-label={state === "idle" ? label : undefined}
      >
        {state === "copied" ? (
          <CheckIcon className="text-primary" aria-hidden="true" />
        ) : (
          <CopyIcon aria-hidden="true" />
        )}
        {state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : label}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Couldn't copy" : ""}
      </span>
    </>
  );
}
