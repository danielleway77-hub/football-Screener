import { InfoIcon, PieChartIcon } from "lucide-react";
import { AnimatedBar } from "@/components/motion/AnimatedBar";
import { cn } from "@/lib/utils";
import { derived, highest1x2, pairLeader } from "./logic";
import { PctCount } from "./PctCount";
import { TeamLogo } from "./TeamLogo";
import { formatPct } from "@/lib/format";

export type PanelProbabilities = {
  homeWin: number | null;
  draw: number | null;
  awayWin: number | null;
  /** Probability of "Yes". "No" is derived. */
  btts: number | null;
  /** Probability of "Over 2.5". "Under" is derived. */
  over25: number | null;
};

type ProbabilityPanelProps = {
  home: { name: string; logoUrl: string | null };
  away: { name: string; logoUrl: string | null };
  probabilities: PanelProbabilities;
  predictedHome: number | null;
  predictedAway: number | null;
  className?: string;
};

function AiChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "rounded-sm bg-violet-soft px-1.5 text-xs leading-4 font-bold tracking-wider text-violet",
        className,
      )}
    >
      <span aria-hidden="true">AI</span>
      <span className="sr-only">Prediction from the data source</span>
    </span>
  );
}

function BarRow({
  label,
  value,
  highest,
  index,
  logo,
}: {
  label: string;
  value: number | null;
  highest: boolean;
  index: number;
  logo?: React.ReactNode;
}) {
  const missing = value === null;
  return (
    <li
      data-testid="prob-row"
      data-highest={highest || undefined}
      data-missing={missing || undefined}
      className="flex min-h-14 flex-col justify-center gap-1.5 border-b border-border py-2 last:border-b-0"
    >
      <div className="flex items-center gap-2.5">
        {logo ?? <span aria-hidden="true" className="size-7 shrink-0" />}
        <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold tracking-[0.04em] uppercase">
          {label}
        </span>
        {missing ? (
          <span className="flex shrink-0 items-center gap-1.5 text-sm text-faint">
            <InfoIcon className="size-3.5" aria-hidden="true" />
            Unavailable
          </span>
        ) : (
          <span
            data-testid="prob-pill"
            className={cn(
              "num shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold",
              highest ? "bg-primary-soft text-primary" : "bg-surface-raised text-foreground",
            )}
          >
            <PctCount value={value} />
            {highest ? <span className="sr-only"> (highest)</span> : null}
          </span>
        )}
      </div>
      <div
        data-testid="prob-track"
        className={cn(
          "h-2 overflow-hidden rounded-full",
          missing ? "border border-dashed border-border-strong" : "bg-track",
        )}
      >
        {missing ? null : (
          <AnimatedBar
            pct={value}
            index={index}
            className={cn("rounded-full", highest ? "bg-primary" : "bg-neutral-bar")}
          />
        )}
      </div>
    </li>
  );
}

function ValueTile({
  label,
  value,
  lead,
  calculated,
  groupLabel,
}: {
  label: string;
  value: number | null;
  lead: boolean;
  calculated?: boolean;
  groupLabel: string;
}) {
  const missing = value === null;
  return (
    <div
      role="group"
      aria-label={
        missing
          ? `${groupLabel} ${label}: unavailable`
          : `${groupLabel} ${label}: ${formatPct(value).replace("%", "")} percent${calculated ? " (calculated)" : ""}`
      }
      title={calculated && !missing ? "Calculated as 100 minus the other value." : undefined}
      data-testid="prob-tile"
      data-lead={lead || undefined}
      data-missing={missing || undefined}
      className={cn(
        "flex h-16 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border bg-surface-raised",
        missing ? "border-dashed border-border-strong" : "border-hairline",
      )}
    >
      <p aria-hidden="true" className="text-sm leading-none text-muted-foreground">
        {label}
      </p>
      {missing ? (
        <p className="flex items-center gap-1.5 text-faint">
          <span aria-hidden="true" className="num text-2xl leading-none font-semibold">
            —
          </span>
          <InfoIcon className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Unavailable</span>
        </p>
      ) : (
        <p
          aria-hidden="true"
          className={cn(
            "num text-2xl leading-none font-semibold",
            lead ? "text-primary" : "text-foreground",
          )}
        >
          <PctCount value={value} />
        </p>
      )}
    </div>
  );
}

function PairSection({
  title,
  aLabel,
  aValue,
  bLabel,
}: {
  title: string;
  aLabel: string;
  aValue: number | null;
  bLabel: string;
}) {
  const bValue = derived(aValue);
  const leader = pairLeader(aValue, bValue);
  return (
    <section className="space-y-2 border-t border-border pt-4">
      <h3 className="text-overline text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-2 gap-3">
        <ValueTile label={aLabel} value={aValue} lead={leader === "a"} groupLabel={title} />
        <ValueTile
          label={bLabel}
          value={bValue}
          lead={leader === "b"}
          calculated
          groupLabel={title}
        />
      </div>
    </section>
  );
}

/**
 * "Exact probabilities" for the detail page (mirrors the client's PrediGoal panel, restyled):
 * predicted score, Home · Draw · Away bars (highest lime only when all three exist and nothing ties),
 * Both teams to score and Over/Under 2.5 tiles ("No"/"Under" derived as 100 - value). Missing values
 * read "Unavailable", never 0; without a predicted score the hero tile is hidden.
 */
export function ProbabilityPanel({
  home,
  away,
  probabilities: p,
  predictedHome,
  predictedAway,
  className,
}: ProbabilityPanelProps) {
  const top = highest1x2(p.homeWin, p.draw, p.awayWin);
  const hasScore = predictedHome !== null && predictedAway !== null;
  return (
    <div
      role="group"
      aria-label="Exact probabilities"
      data-testid="probability-panel"
      className={cn("space-y-4", className)}
    >
      <div className="flex items-center gap-2">
        <PieChartIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-overline flex-1 text-muted-foreground">Exact probabilities</h2>
        <AiChip />
      </div>

      {hasScore ? (
        <div
          data-testid="predicted-score-tile"
          className="rounded-lg bg-surface-raised p-5 text-center accent-border"
        >
          <p className="text-overline flex items-center justify-center gap-2 text-muted-foreground">
            Predicted score <AiChip />
          </p>
          <p className="text-stat-xl mt-3">
            <span role="img" aria-label={`Predicted score ${predictedHome} ${predictedAway}`}>
              <span className="text-primary">{predictedHome}</span>
              <span className="px-3 text-faint">–</span>
              <span className="text-primary">{predictedAway}</span>
            </span>
          </p>
          <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <TeamLogo name={home.name} src={home.logoUrl} size={28} />
            <span className="min-w-0 truncate" title={home.name}>
              {home.name}
            </span>
            <span aria-hidden="true">–</span>
            <span className="min-w-0 truncate" title={away.name}>
              {away.name}
            </span>
            <TeamLogo name={away.name} src={away.logoUrl} size={28} />
          </p>
        </div>
      ) : null}

      <ul data-testid="prob-1x2" aria-label="Match result probabilities">
        <BarRow
          index={0}
          label={`Win ${home.name}`}
          value={p.homeWin}
          highest={top === "home"}
          logo={<TeamLogo name={home.name} src={home.logoUrl} size={28} />}
        />
        <BarRow index={1} label="Draw" value={p.draw} highest={top === "draw"} />
        <BarRow
          index={2}
          label={`Win ${away.name}`}
          value={p.awayWin}
          highest={top === "away"}
          logo={<TeamLogo name={away.name} src={away.logoUrl} size={28} />}
        />
      </ul>

      <PairSection title="Both teams to score" aLabel="Yes" aValue={p.btts} bLabel="No" />
      <PairSection title="Over / Under 2.5 goals" aLabel="Over" aValue={p.over25} bLabel="Under" />
    </div>
  );
}
