import { AlertTriangleIcon, BadgeCheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type QualifiesChipProps = { variant?: "qualifies" | "no-longer"; className?: string };

/** 28px status pill. Colour is never the only signal: icon + text. */
export function QualifiesChip({ variant = "qualifies", className }: QualifiesChipProps) {
  const ok = variant === "qualifies";
  return (
    <span
      data-testid="qualifies-chip"
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-4xl border px-2.5 text-xs font-bold tracking-[0.08em] whitespace-nowrap",
        ok
          ? "border-primary-border bg-primary-soft text-primary"
          : "border-warning/40 bg-warning-soft text-warning",
        className,
      )}
    >
      {ok ? (
        <BadgeCheckIcon className="size-3.5" aria-hidden="true" />
      ) : (
        <AlertTriangleIcon className="size-3.5" aria-hidden="true" />
      )}
      {ok ? "QUALIFIES" : "NO LONGER QUALIFIES"}
    </span>
  );
}
