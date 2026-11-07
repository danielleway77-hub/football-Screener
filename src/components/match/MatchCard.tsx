import Link from "next/link";
import { ClockIcon, TrophyIcon } from "lucide-react";
import { CardSheen } from "@/components/motion/CardSheen";
import { SpotlightCard } from "@/components/motion/SpotlightCard";
import { cn } from "@/lib/utils";
import { MATCH_CARD_MIN_HEIGHT_CLASS } from "./dimensions";
import { FormBar } from "./FormBar";
import { formatPct } from "@/lib/format";
import { formStrength, STRENGTH_WORD } from "./logic";
import { PredictedScore } from "./PredictedScore";
import { ProbabilityGrid, type Probabilities } from "./ProbabilityGrid";
import { QualifiesChip } from "./QualifiesChip";
import { TeamLogo } from "./TeamLogo";

export type MatchCardTeam = { name: string; logoUrl: string | null; pct: number };

/** Plain, already-formatted data for one card (built on the server; no Dates, no client work). */
export type MatchCardData = {
  id: string;
  /** "Peru · Liga 1" */
  league: string | null;
  /** "Wed 4 Nov · 19:45" in the owner's timezone */
  kickoffLabel: string;
  /** "in 1 day" */
  relativeLabel?: string;
  qualifies: boolean;
  strongSide: "HOME" | "AWAY" | null;
  formScope: "league" | "overall";
  home: MatchCardTeam;
  away: MatchCardTeam;
  probabilities: Probabilities;
  predicted: { home: number; away: number } | null;
  confidence: "LOW" | "MEDIUM" | "HIGH" | null;
};

type MatchCardProps = {
  data: MatchCardData;
  low: number;
  high: number;
  /** Position in the list (stagger of the bar fills). */
  index?: number;
  className?: string;
  /** Detail link; the dashboard passes one that carries `?from=` so Back keeps the filters. */
  href?: string;
};

function TeamRow({
  team,
  low,
  high,
  index,
}: {
  team: MatchCardTeam;
  low: number;
  high: number;
  index: number;
}) {
  return (
    <FormBar
      pct={team.pct}
      low={low}
      high={high}
      teamName={team.name}
      index={index}
      leading={
        <>
          <TeamLogo name={team.name} src={team.logoUrl} size={28} />
          <h3 title={team.name} className="text-h4 min-w-0 truncate">
            {team.name}
          </h3>
        </>
      }
    />
  );
}

/**
 * The signature card. ONE link (a stretched anchor); nothing else inside is interactive, so the
 * source link is never in here. Heights come from `dimensions.ts`, shared with the skeleton.
 */
export function MatchCard({ data, low, high, index = 0, className, href }: MatchCardProps) {
  const strongTeam =
    data.strongSide === "HOME" ? data.home : data.strongSide === "AWAY" ? data.away : null;
  const scopeLabel = data.formScope === "league" ? "League form" : "Overall form";
  const linkLabel = strongTeam
    ? `${data.home.name} vs ${data.away.name}, ${data.qualifies ? "qualifies" : "does not qualify"}, ${strongTeam.name} form ${formatPct(strongTeam.pct).replace("%", "")} percent, ${STRENGTH_WORD[formStrength(strongTeam.pct, low, high)]}`
    : `${data.home.name} vs ${data.away.name}`;

  return (
    <SpotlightCard
      as="article"
      data-testid="match-card"
      data-qualifies={data.qualifies}
      contentClassName="flex flex-col p-4 md:p-5"
      className={cn(
        "surface-1 bg-grad-card @container relative flex flex-col rounded-lg transition-[transform,border-color,box-shadow] duration-200 ease-out",
        MATCH_CARD_MIN_HEIGHT_CLASS,
        data.qualifies && "glow-accent accent-border",
        "hover:-translate-y-1 hover:border-border-strong hover:shadow-lg active:translate-y-0 active:scale-[0.992] active:shadow-sm motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100",
        "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-primary",
        className,
      )}
    >
      <div className="flex h-7 items-center justify-between gap-2">
        <p
          className="text-caption flex min-w-0 items-center gap-1.5 text-muted-foreground"
          title={data.league ?? undefined}
        >
          <TrophyIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{data.league ?? "League unavailable"}</span>
        </p>
        <QualifiesChip variant={data.qualifies ? "qualifies" : "no-longer"} />
      </div>

      <div className="mt-2 flex h-5 items-center justify-between gap-2">
        <p className="text-caption flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <ClockIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="num shrink-0">{data.kickoffLabel}</span>
          {data.relativeLabel ? (
            <span className="min-w-0 truncate text-faint">{data.relativeLabel}</span>
          ) : null}
        </p>
        {data.predicted ? (
          <PredictedScore home={data.predicted.home} away={data.predicted.away} />
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <TeamRow team={data.home} low={low} high={high} index={index} />
        <TeamRow team={data.away} low={low} high={high} index={index} />
      </div>

      <div aria-hidden="true" className="my-2 h-px bg-hairline" />

      <ProbabilityGrid probabilities={data.probabilities} />

      <div className="mt-auto flex h-[30px] items-end justify-between gap-2 pt-2.5 pb-0">
        <p className="text-caption min-w-0 truncate text-muted-foreground">
          {strongTeam ? `Strong: ${strongTeam.name} · ` : ""}
          {scopeLabel}
        </p>
        {data.confidence ? (
          <span
            data-testid="confidence-chip"
            className="shrink-0 rounded-4xl bg-violet-soft px-2 text-xs leading-5 font-semibold text-violet"
          >
            <span className="sr-only">Confidence </span>
            {data.confidence}
          </span>
        ) : null}
      </div>

      <Link
        href={href ?? `/matches/${data.id}`}
        className="absolute inset-0 rounded-[inherit] outline-none"
      >
        <span className="sr-only">{linkLabel}</span>
      </Link>
      {data.qualifies ? <CardSheen /> : null}
    </SpotlightCard>
  );
}
