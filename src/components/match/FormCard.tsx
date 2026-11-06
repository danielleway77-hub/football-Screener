import { explainQualification, formGapPts } from "@/lib/match-detail";
import { FormBadges } from "./FormBadges";
import { FormBar } from "./FormBar";
import { PtsCount } from "./PtsCount";
import { TeamLogo } from "./TeamLogo";

type Team = { name: string; logoUrl: string | null; pct: number; results: string | null };

type FormCardProps = {
  home: Team;
  away: Team;
  low: number;
  high: number;
  scopeLabel: string;
};

function TeamBlock({
  team,
  low,
  high,
  index,
}: {
  team: Team;
  low: number;
  high: number;
  index: number;
}) {
  return (
    <div data-testid="form-team" className="space-y-3">
      <FormBar
        size="lg"
        pct={team.pct}
        low={low}
        high={high}
        teamName={team.name}
        index={index}
        leading={
          <>
            <TeamLogo name={team.name} src={team.logoUrl} size={28} />
            <span className="min-w-0 truncate text-[0.9375rem] font-semibold" title={team.name}>
              {team.name}
            </span>
          </>
        }
      />
      <FormBadges results={team.results} />
    </div>
  );
}

/** Recent form: a large bar per team, W/D/L badges, the form gap and the rule explained in words. */
export function FormCard({ home, away, low, high, scopeLabel }: FormCardProps) {
  const gap = formGapPts(home.pct, away.pct);
  const sentence = explainQualification({
    homeName: home.name,
    awayName: away.name,
    homePct: home.pct,
    awayPct: away.pct,
    low,
    high,
  });
  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-overline text-muted-foreground">Recent form</h2>
        <p className="text-caption text-faint">{scopeLabel}</p>
      </div>
      <div className="space-y-6">
        <TeamBlock team={home} low={low} high={high} index={0} />
        <TeamBlock team={away} low={low} high={high} index={1} />
      </div>
      <div
        data-testid="form-gap"
        className="rounded-md border border-hairline bg-surface-raised p-4"
      >
        <p className="text-overline text-muted-foreground">Form gap</p>
        <p className="text-stat-xl mt-2">
          <PtsCount value={gap} />
        </p>
        <p className="text-caption mt-2 text-muted-foreground">
          Difference between the two teams&apos; form
        </p>
      </div>
      <p data-testid="form-explanation" className="text-body-sm text-muted-foreground">
        {sentence}
      </p>
    </div>
  );
}
