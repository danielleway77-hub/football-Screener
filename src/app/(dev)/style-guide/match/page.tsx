import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { FormBadges } from "@/components/match/FormBadges";
import { FormBar } from "@/components/match/FormBar";
import { MatchCard } from "@/components/match/MatchCard";
import { MOCK_CARDS } from "@/components/match/mock-data";
import { QualifiesChip } from "@/components/match/QualifiesChip";
import { TeamLogo } from "@/components/match/TeamLogo";
import { MatchCardSkeleton } from "@/components/states/Skeletons";

export const metadata: Metadata = { title: "Style guide: match components" };

const LOW = 35;
const HIGH = 75;

/** Dev-only specimen of the match component family and its states (404 in production). */
export default function MatchStyleGuidePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <PageContainer width="wide" className="space-y-10 py-10">
      <div data-testid="match-style-guide" className="space-y-2">
        <p className="text-overline text-faint">STYLE GUIDE</p>
        <h1 className="text-h1">Match components</h1>
        <p className="text-body-sm text-muted-foreground">
          Thresholds {LOW}% / {HIGH}%. Every state of the card, the form bar and the small parts.
        </p>
      </div>

      <section aria-labelledby="sg-cards" className="space-y-4">
        <h2 id="sg-cards" className="text-h3">
          Match card states
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4">
          {MOCK_CARDS.map(({ label, data }, i) => (
            <figure key={data.id} className="space-y-2" data-testid="card-specimen">
              <figcaption className="text-caption text-muted-foreground">{label}</figcaption>
              <MatchCard data={data} low={LOW} high={HIGH} index={i} />
            </figure>
          ))}
          <figure className="space-y-2" data-testid="skeleton-specimen">
            <figcaption className="text-caption text-muted-foreground">Card skeleton</figcaption>
            <MatchCardSkeleton />
          </figure>
        </div>
      </section>

      <section aria-labelledby="sg-bars" className="space-y-4">
        <h2 id="sg-bars" className="text-h3">
          Form bar: strength states and extremes
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[80, 50, 7, 100, 0, 75, 35, 74.9, 34.9, 62.5].map((pct) => (
            <div key={pct} className="surface-1 rounded-lg p-4" data-testid="bar-specimen">
              <FormBar
                pct={pct}
                low={LOW}
                high={HIGH}
                teamName={`Team ${pct}`}
                leading={<TeamLogo name={`Team ${pct}`} size={28} />}
              />
            </div>
          ))}
          <div className="surface-1 rounded-lg p-4 md:col-span-3">
            <p className="text-caption mb-3 text-muted-foreground">Large (detail page)</p>
            <FormBar pct={80} low={LOW} high={HIGH} teamName="Sporting Cristal" size="lg" />
          </div>
        </div>
      </section>

      <section aria-labelledby="sg-parts" className="space-y-4">
        <h2 id="sg-parts" className="text-h3">
          Small parts
        </h2>
        <div className="flex flex-wrap items-center gap-6">
          <FormBadges results="WWDLW" />
          <FormBadges results="LLLLL" />
          <QualifiesChip />
          <QualifiesChip variant="no-longer" />
          <TeamLogo name="Sporting Cristal" size={28} />
          <TeamLogo name="Sporting Cristal" size={40} />
          <TeamLogo name="Sporting Cristal" size={56} />
          <TeamLogo name="Broken" src="https://invalid.example/none.png" size={40} />
        </div>
      </section>
    </PageContainer>
  );
}
