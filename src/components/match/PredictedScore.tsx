import { GoalIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PredictedScoreProps = {
  home: number | null;
  away: number | null;
  className?: string;
};

/** "3 - 1" in mono with an AI micro-chip. Hidden entirely when the source gave no score. */
export function PredictedScore({ home, away, className }: PredictedScoreProps) {
  if (home === null || away === null) return null;
  return (
    <span
      data-testid="predicted-score"
      className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap", className)}
    >
      <span className="sr-only">{`Predicted score ${home} ${away} from the data source`}</span>
      <span aria-hidden="true" className="num inline-flex items-center gap-1 text-sm font-semibold">
        <GoalIcon className="size-3.5 text-muted-foreground" />
        {home} – {away}
      </span>
      <span
        aria-hidden="true"
        className="rounded-sm bg-violet-soft px-1.5 text-xs leading-4 font-bold tracking-wider text-violet"
      >
        AI
      </span>
    </span>
  );
}
