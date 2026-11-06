"use client";

import { CheckIcon, XCircleIcon } from "lucide-react";
import { QualifiesChip } from "@/components/match/QualifiesChip";
import { Input } from "@/components/ui/input";
import { explainTextReason, type PreviewRow, type TextDraft } from "@/lib/import/model";

type TextMatchesProps = {
  drafts: TextDraft[];
  rows: PreviewRow[];
  timezone: string;
  onEdit: (index: number, patch: Partial<TextDraft>) => void;
};

type TextKey = "home" | "away" | "homeForm" | "awayForm" | "league";

/**
 * Parsed matches from a pasted page, each with editable cells. Values the parser could not find are shown
 * as "Unavailable" (empty field with that placeholder) and block the import until the owner types them.
 * A kickoff that was not in the text has to be picked with the date/time field.
 */
export function TextMatches({ drafts, rows, timezone, onEdit }: TextMatchesProps) {
  return (
    <ul className="space-y-4" data-testid="text-matches">
      {drafts.map((d, i) => {
        const row = rows.find((r) => r.index === i);
        const p = d.parsed;
        const chips = [
          p.homeWin !== null && p.draw !== null && p.awayWin !== null
            ? `Home ${p.homeWin}% · Draw ${p.draw}% · Away ${p.awayWin}%`
            : null,
          p.btts !== null ? `BTTS Yes ${p.btts}%` : null,
          p.over25 !== null ? `Over 2.5 ${p.over25}%` : null,
          p.predictedHome !== null ? `Predicted ${p.predictedHome} – ${p.predictedAway}` : null,
        ].filter((c): c is string => c !== null);
        const field = (id: string, label: string, key: TextKey, numeric = false) => (
          <div className="min-w-0">
            <label
              htmlFor={`${id}-${i}`}
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              {label}
            </label>
            <Input
              id={`${id}-${i}`}
              value={d[key]}
              placeholder="Unavailable"
              inputMode={numeric ? "numeric" : undefined}
              autoComplete="off"
              onChange={(e) => onEdit(i, { [key]: e.target.value })}
              className={numeric ? "num" : undefined}
            />
          </div>
        );
        return (
          <li
            key={i}
            data-testid="text-match"
            data-valid={row?.valid ?? false}
            className="space-y-3 rounded-md border border-hairline bg-subtle/40 p-4"
          >
            <p className="num text-xs text-muted-foreground">Match {i + 1}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {field("home", "Home team", "home")}
              {field("away", "Away team", "away")}
              {field("home-form", "Home form %", "homeForm", true)}
              {field("away-form", "Away form %", "awayForm", true)}
              {field("league", "League (optional)", "league")}
              <div className="min-w-0">
                <label
                  htmlFor={`kickoff-${i}`}
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Kickoff ({timezone.replaceAll("_", " ")}){d.kickoffFromText ? "" : " — confirm"}
                </label>
                <Input
                  id={`kickoff-${i}`}
                  type="datetime-local"
                  value={d.kickoffLocal}
                  onChange={(e) =>
                    onEdit(i, { kickoffLocal: e.target.value, kickoffFromText: false })
                  }
                />
              </div>
            </div>
            {chips.length > 0 ? (
              <p className="text-caption flex flex-wrap gap-x-4 gap-y-1 text-faint">
                {chips.map((c) => (
                  <span key={c} className="num">
                    {c}
                  </span>
                ))}
              </p>
            ) : (
              <p className="text-caption text-faint">Probabilities: Unavailable</p>
            )}
            {row ? (
              row.valid ? (
                <p className="flex flex-wrap items-center gap-2 text-sm text-positive">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckIcon className="size-4" aria-hidden="true" /> OK
                  </span>
                  {row.qualifies ? <QualifiesChip /> : null}
                </p>
              ) : (
                <p className="flex items-start gap-1.5 text-sm text-negative">
                  <XCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {explainTextReason(row.reason)}
                </p>
              )
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
