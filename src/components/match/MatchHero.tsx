import Link from "next/link";
import { ClockIcon, TrophyIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormDuel } from "./FormDuel";
import { QualifiesChip } from "./QualifiesChip";
import { TeamLogo } from "./TeamLogo";

type HeroTeam = { name: string; logoUrl: string | null; pct: number };

type MatchHeroProps = {
  home: HeroTeam;
  away: HeroTeam;
  /** "Peru · Liga 1" (already joined, omitted parts skipped) or null. */
  competition: string | null;
  kickoff: string;
  relative: string;
  qualifies: boolean;
  /** Name of the strong team under the current thresholds, or null when there is none. */
  strongName: string | null;
  scopeLabel: string;
  confidence: "LOW" | "MEDIUM" | "HIGH" | null;
  low: number;
  high: number;
};

const CONFIDENCE_LEVEL = { LOW: 1, MEDIUM: 2, HIGH: 3 } as const;

/** Small violet meter (3 segments) with the word, so the level never relies on colour alone. */
function ConfidenceMeter({ level }: { level: "LOW" | "MEDIUM" | "HIGH" }) {
  const filled = CONFIDENCE_LEVEL[level];
  return (
    <span
      data-testid="confidence"
      className="inline-flex h-7 items-center gap-2 rounded-4xl bg-violet-soft px-2.5 text-xs font-bold tracking-[0.08em] text-violet"
    >
      <span aria-hidden="true" className="flex items-end gap-0.5">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn("w-1 rounded-xs bg-current", i <= filled ? "opacity-100" : "opacity-30")}
            style={{ height: `${4 + i * 3}px` }}
          />
        ))}
      </span>
      Confidence {level}
    </span>
  );
}

function Team({ team, side }: { team: HeroTeam; side: "Home" | "Away" }) {
  return (
    <div className="flex min-w-0 items-center gap-4" data-testid={`hero-${side.toLowerCase()}`}>
      <TeamLogo name={team.name} src={team.logoUrl} size={56} />
      <div className="min-w-0">
        <h2
          className="text-h2 line-clamp-2 [overflow-wrap:anywhere]"
          title={team.name.length > 40 ? team.name : undefined}
        >
          {team.name}
        </h2>
        <p className="text-caption text-faint">{side}</p>
      </div>
    </div>
  );
}

/** The match header: competition and time, verdict chip, both teams, the strong side and a reserved FormDuel slot. */
export function MatchHero({
  home,
  away,
  competition,
  kickoff,
  relative,
  qualifies,
  strongName,
  scopeLabel,
  confidence,
  low,
  high,
}: MatchHeroProps) {
  return (
    <section
      data-testid="match-hero"
      aria-label="Match"
      className="surface-1 bg-grad-card rounded-xl p-5 accent-border md:p-8"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        {competition ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <TrophyIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{competition}</span>
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <ClockIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="num">{kickoff}</span>
          <span className="text-caption text-faint">{relative}</span>
        </span>
        <QualifiesChip variant={qualifies ? "qualifies" : "no-longer"} className="sm:ml-auto" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-8">
        <Team team={home} side="Home" />
        <div aria-hidden="true" className="flex items-center gap-3 lg:justify-center">
          <span className="h-px flex-1 bg-border lg:hidden" />
          <span className="text-caption text-faint">vs</span>
          <span className="h-px flex-1 bg-border lg:hidden" />
        </div>
        <Team team={away} side="Away" />
      </div>

      <div
        data-testid="form-duel-slot"
        className="mt-5 flex flex-col gap-4 border-t border-border pt-4"
      >
        <FormDuel home={home} away={away} low={low} high={high} qualifies={qualifies} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-caption text-muted-foreground">
            {strongName ? (
              <>
                Strong: <span className="font-semibold text-foreground">{strongName}</span> ·{" "}
                {scopeLabel}
              </>
            ) : (
              scopeLabel
            )}
          </p>
          {confidence ? <ConfidenceMeter level={confidence} /> : null}
        </div>
        {qualifies ? null : (
          <p
            data-testid="no-longer-note"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning"
          >
            <span>
              No longer qualifies under your current thresholds ({high}% / {low}%).
            </span>
            <Link href="/settings" className="font-semibold underline underline-offset-4">
              Change thresholds
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
