import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { FormDuel } from "@/components/match/FormDuel";
import { evaluateMatch } from "@/server/domain/screening";

export const metadata: Metadata = { title: "Style guide: FormDuel" };

const LOW = 35;
const HIGH = 75;
const LONG = "Associazione Sportiva Dilettantistica Unione Calcio Real Sociedad";

const CASES: { id: string; label: string; home: number; away: number; names?: [string, string] }[] =
  [
    { id: "80-7", label: "80 / 7 (qualifies)", home: 80, away: 7 },
    { id: "30-82", label: "30 / 82 (away strong)", home: 30, away: 82 },
    { id: "50-50", label: "50 / 50 (markers overlap)", home: 50, away: 50 },
    { id: "100-0", label: "100 / 0", home: 100, away: 0 },
    { id: "0-100", label: "0 / 100", home: 0, away: 100 },
    { id: "76-34", label: "76 / 34 (qualifies)", home: 76, away: 34 },
    { id: "75-35", label: "75 / 35 (does not qualify)", home: 75, away: 35 },
    { id: "74.9-35.1", label: "74.9 / 35.1", home: 74.9, away: 35.1 },
    { id: "long", label: "Long names", home: 80, away: 7, names: [LONG, LONG + " B"] },
    { id: "55-60", label: "55 / 60 (labels pushed apart)", home: 55, away: 60 },
  ];

/** Dev-only specimen of every FormDuel edge case (404 in production). */
export default function FormDuelStyleGuidePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main>
      <PageContainer width="content" className="space-y-8 py-10">
        <div className="space-y-2">
          <p className="text-overline text-faint">STYLE GUIDE</p>
          <h1 className="text-h1">FormDuel</h1>
          <p className="text-body-sm text-muted-foreground">
            Thresholds {LOW}% / {HIGH}%. Logos are missing on purpose (initials fallback).
          </p>
        </div>
        {CASES.map((c) => {
          const names = c.names ?? ["Home FC", "Away FC"];
          const qualifies = evaluateMatch(
            { homeFormPct: c.home, awayFormPct: c.away },
            { high: HIGH, low: LOW },
          ).qualifies;
          return (
            <section
              key={c.id}
              data-testid={`duel-case-${c.id}`}
              className="surface-1 rounded-lg p-5"
            >
              <h2 className="text-caption mb-3 text-muted-foreground">{c.label}</h2>
              <FormDuel
                home={{ name: names[0], logoUrl: null, pct: c.home }}
                away={{ name: names[1], logoUrl: null, pct: c.away }}
                low={LOW}
                high={HIGH}
                qualifies={qualifies}
              />
            </section>
          );
        })}
      </PageContainer>
    </main>
  );
}
