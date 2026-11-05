import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

/** "Still working…" hint shown under a pending element once a request exceeds ~3 s. */
export function SlowHint({ active, className }: { active: boolean; className?: string }) {
  if (!active) return null;
  return (
    <p
      role="status"
      className={cn("mt-2 flex items-center gap-2 text-xs text-muted-foreground", className)}
    >
      <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
      Still working… this is taking longer than usual.
    </p>
  );
}
