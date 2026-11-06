import { cn } from "@/lib/utils";
import { parseResults } from "./logic";

const STYLE = {
  W: { cls: "bg-positive-soft text-positive", label: "Win" },
  D: { cls: "bg-neutral-soft text-neutral-signal", label: "Draw" },
  L: { cls: "bg-negative-soft text-negative", label: "Loss" },
} as const;

/** Last results as W/D/L squares, oldest left, newest right. Renders nothing when empty. */
export function FormBadges({
  results,
  className,
}: {
  results: string | null | undefined;
  className?: string;
}) {
  const parsed = parseResults(results);
  if (parsed.length === 0) return null;
  return (
    <ul aria-label="Recent results, oldest to newest" className={cn("flex gap-1.5", className)}>
      {parsed.map((r, i) => (
        <li
          key={i}
          aria-label={STYLE[r].label}
          className={cn(
            "num flex size-7 items-center justify-center rounded-sm text-xs font-bold",
            STYLE[r].cls,
          )}
        >
          <span aria-hidden="true">{r}</span>
        </li>
      ))}
    </ul>
  );
}
