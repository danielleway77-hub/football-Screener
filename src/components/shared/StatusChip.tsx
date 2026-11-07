import { cn } from "@/lib/utils";

export type ChipStatus =
  "SUCCESS" | "PARTIAL" | "FAILED" | "RUNNING" | "SKIPPED" | "NO_DATA" | "STALE";

const STYLE: Record<ChipStatus, { cls: string; text: string }> = {
  SUCCESS: { cls: "border-positive/40 bg-positive-soft text-positive", text: "SUCCESS" },
  PARTIAL: { cls: "border-warning/40 bg-warning-soft text-warning", text: "PARTIAL" },
  FAILED: { cls: "border-negative/40 bg-negative-soft text-negative", text: "FAILED" },
  RUNNING: { cls: "border-primary-border bg-primary-soft text-primary", text: "RUNNING" },
  SKIPPED: { cls: "border-hairline-strong bg-neutral-soft text-muted-foreground", text: "SKIPPED" },
  NO_DATA: { cls: "border-hairline-strong bg-neutral-soft text-muted-foreground", text: "NO DATA" },
  STALE: { cls: "border-warning/40 bg-warning-soft text-warning", text: "STALE" },
};

/** 28px run-status pill: dot + text (colour is never the only signal). RUNNING has a pulsing dot. */
export function StatusChip({ status, className }: { status: ChipStatus; className?: string }) {
  const s = STYLE[status];
  return (
    <span
      data-testid="status-chip"
      data-status={status}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-2 rounded-4xl border px-2.5 text-xs font-bold tracking-[0.08em] whitespace-nowrap",
        s.cls,
        className,
      )}
    >
      <span aria-hidden="true" className="relative inline-flex size-2">
        {status === "RUNNING" ? (
          <span className="run-ping absolute inset-0 rounded-full bg-current opacity-60" />
        ) : null}
        <span
          className={cn(
            "relative size-2 rounded-full bg-current",
            status === "RUNNING" && "animate-pulse motion-reduce:animate-none",
          )}
        />
      </span>
      {s.text}
    </span>
  );
}
