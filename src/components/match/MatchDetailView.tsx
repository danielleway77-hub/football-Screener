import { BackLink } from "@/components/layout/BackLink";
import { ExternalLink } from "@/components/shared/ExternalLink";
import { Reveal } from "@/components/motion/Reveal";
import { FormCard } from "./FormCard";
import { MatchHero } from "./MatchHero";
import { MatchStickyBar } from "./MatchStickyBar";
import { MatchPager, type PagerTarget } from "./MatchPager";
import { ProbabilityPanel, type PanelProbabilities } from "./ProbabilityPanel";

/** Everything the page shows, already formatted for display (no Dates, no settings object). */
export type MatchDetailModel = {
  home: { name: string; logoUrl: string | null; pct: number; results: string | null };
  away: { name: string; logoUrl: string | null; pct: number; results: string | null };
  competition: string | null;
  kickoff: string;
  relative: string;
  qualifies: boolean;
  strongName: string | null;
  scopeLabel: string;
  confidence: "LOW" | "MEDIUM" | "HIGH" | null;
  low: number;
  high: number;
  probabilities: PanelProbabilities;
  predictedHome: number | null;
  predictedAway: number | null;
  fetched: string;
  source: string;
  sourceUrl: string | null;
  backHref: string;
  previous: PagerTarget;
  next: PagerTarget;
};

const CARD = "surface-1 bg-grad-card h-full rounded-lg p-5 md:p-6";

/**
 * Page grid: back link and pager share the first row at >= 768px; on phones the pager is the LAST
 * row. Hero, then Form (7/12) and Probabilities (5/12) at >= 1024px, then the meta row.
 */
export function MatchDetailView({ m }: { m: MatchDetailModel }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:gap-x-4 md:gap-y-4">
      <MatchStickyBar
        title={`${m.home.name} vs ${m.away.name}`}
        qualifies={m.qualifies}
        score={
          m.predictedHome !== null && m.predictedAway !== null
            ? `${m.predictedHome} – ${m.predictedAway}`
            : null
        }
      />
      <div className="md:col-start-1 md:row-start-1">
        <BackLink href={m.backHref} />
      </div>
      <MatchPager
        previous={m.previous}
        next={m.next}
        className="order-last md:order-none md:col-start-2 md:row-start-1"
      />
      <div className="space-y-6 md:col-span-2">
        <Reveal>
          <MatchHero
            home={m.home}
            away={m.away}
            competition={m.competition}
            kickoff={m.kickoff}
            relative={m.relative}
            qualifies={m.qualifies}
            strongName={m.strongName}
            scopeLabel={m.scopeLabel}
            confidence={m.confidence}
            low={m.low}
            high={m.high}
          />
        </Reveal>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
          <Reveal delay={0.06} className="*:h-full lg:col-span-7">
            <section data-testid="form-card" aria-label="Recent form" className={CARD}>
              <FormCard
                home={m.home}
                away={m.away}
                low={m.low}
                high={m.high}
                scopeLabel={m.scopeLabel}
              />
            </section>
          </Reveal>
          <Reveal delay={0.12} className="*:h-full lg:col-span-5">
            <section data-testid="probability-card" aria-label="Probabilities" className={CARD}>
              <ProbabilityPanel
                home={m.home}
                away={m.away}
                probabilities={m.probabilities}
                predictedHome={m.predictedHome}
                predictedAway={m.predictedAway}
              />
              <p className="text-caption mt-4 text-faint">From the data source at {m.fetched}.</p>
            </section>
          </Reveal>
        </div>
        <div
          data-testid="meta-row"
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="num text-xs text-muted-foreground">
            Fetched {m.fetched} · Source: {m.source}
          </p>
          {m.sourceUrl ? (
            <ExternalLink
              href={m.sourceUrl}
              data-testid="source-link"
              className="surface-2 min-h-11 justify-center rounded-md px-4 text-[0.9375rem] font-semibold text-foreground no-underline hover:border-border-strong"
            >
              Open on {m.source}
            </ExternalLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}
