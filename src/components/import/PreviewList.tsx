"use client";

import { CheckIcon, XCircleIcon } from "lucide-react";
import { motion } from "framer-motion";
import { QualifiesChip } from "@/components/match/QualifiesChip";
import type { PreviewRow } from "@/lib/import/model";
import { DURATION, EASE_OUT, STAGGER_MAX_ITEMS, useMotionPrefs } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Invalid rows first (so problems are never below the fold), then valid rows, each in file order. */
export function sortRows(rows: PreviewRow[]): PreviewRow[] {
  return [...rows].sort((a, b) => Number(a.valid) - Number(b.valid) || a.index - b.index);
}

export function CountChips({
  valid,
  invalid,
  qualifying,
}: {
  valid: number;
  invalid: number;
  qualifying: number;
}) {
  const chip =
    "inline-flex h-7 items-center gap-2 rounded-4xl border px-3 text-xs font-bold tracking-[0.06em]";
  return (
    <div className="flex flex-wrap gap-2" data-testid="preview-counts">
      <span className={cn(chip, "border-positive/40 bg-positive-soft text-positive")}>
        Valid <span className="num">{valid}</span>
      </span>
      <span
        className={cn(
          chip,
          invalid > 0
            ? "border-negative/40 bg-negative-soft text-negative"
            : "border-hairline-strong bg-neutral-soft text-muted-foreground",
        )}
      >
        Invalid <span className="num">{invalid}</span>
      </span>
      <span className={cn(chip, "border-primary-border bg-primary-soft text-primary")}>
        Qualifying <span className="num">{qualifying}</span>
      </span>
    </div>
  );
}

const forms = (r: PreviewRow) =>
  r.homeForm === null || r.awayForm === null ? "Unavailable" : `${r.homeForm} / ${r.awayForm}`;

function Status({ row }: { row: PreviewRow }) {
  if (row.valid) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm text-positive">
          <CheckIcon className="size-4" aria-hidden="true" /> OK
        </span>
        {row.qualifies ? <QualifiesChip /> : null}
      </span>
    );
  }
  return (
    <span className="inline-flex items-start gap-1.5 rounded-md bg-negative-soft px-2 py-1 text-sm text-negative">
      <XCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{row.reason}</span>
    </span>
  );
}

const Teams = ({ row }: { row: PreviewRow }) => (
  <>
    {row.home ?? "Unavailable"} <span className="text-faint">vs</span> {row.away ?? "Unavailable"}
  </>
);

/** Table from 768px up, stacked cards below (no horizontal scroll at 360). */
export function PreviewList({ rows }: { rows: PreviewRow[] }) {
  const { reduce } = useMotionPrefs();
  const sorted = sortRows(rows);
  // Rows only exist after the owner loaded data (never in the server HTML), so they may animate in.
  const enter = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 6 },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: DURATION.ui,
            ease: EASE_OUT,
            delay: Math.min(i, STAGGER_MAX_ITEMS) * 0.04,
          },
        };
  return (
    <div>
      <div
        data-testid="preview-table"
        className="hidden max-h-[360px] overflow-auto rounded-xl border border-hairline md:block"
      >
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface-raised text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Row</th>
              <th className="px-3 py-2 font-medium">Match</th>
              <th className="px-3 py-2 font-medium">Form H / A</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {sorted.map((row, i) => (
              <motion.tr
                key={row.index}
                data-testid="preview-row"
                data-valid={row.valid}
                className={row.valid ? undefined : "bg-negative-soft/20"}
                {...enter(i)}
              >
                <td className="num px-3 py-3 whitespace-nowrap text-muted-foreground">
                  {row.label}
                </td>
                <td className="px-3 py-3 font-medium">
                  <Teams row={row} />
                </td>
                <td className="num px-3 py-3 whitespace-nowrap">{forms(row)}</td>
                <td className="px-3 py-3">
                  <Status row={row} />
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul data-testid="preview-cards" className="max-h-[360px] space-y-3 overflow-auto md:hidden">
        {sorted.map((row, i) => (
          <motion.li
            key={row.index}
            data-testid="preview-card"
            data-valid={row.valid}
            className={cn(
              "space-y-2 rounded-xl border p-3",
              row.valid ? "border-hairline bg-subtle/40" : "border-negative/40 bg-negative-soft/20",
            )}
            {...enter(i)}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="num text-xs text-muted-foreground">{row.label}</span>
              <span className="num text-sm">{forms(row)}</span>
            </div>
            <p className="text-body font-medium">
              <Teams row={row} />
            </p>
            <Status row={row} />
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
