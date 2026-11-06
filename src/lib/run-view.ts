import { z } from "zod";
import { formatDuration } from "@/lib/format";

/** Serializable run shape shared by the server page and the client list (no Date objects). */
export type RunStatusValue = "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
export type RunItem = { index: number; id?: string; reason: string };
export type RunRow = {
  id: string;
  trigger: "CRON" | "MANUAL" | "INGEST" | "IMPORT";
  provider: string;
  status: RunStatusValue;
  startedAt: string;
  finishedAt: string | null;
  windowFrom: string | null;
  windowTo: string | null;
  scanned: number;
  qualified: number;
  failedCount: number;
  error: string | null;
  details: RunItem[];
};

export const ABANDONED_TEXT = "Run did not finish";
export const DETAILS_DISPLAY_CAP = 200;

const itemSchema = z.object({
  index: z.number().int(),
  id: z.string().optional(),
  reason: z.string(),
});

/** `ScreeningRun.details` is untyped JSON: keep only well-formed items, at most 200. */
export function parseDetails(raw: unknown): RunItem[] {
  if (!Array.isArray(raw)) return [];
  const out: RunItem[] = [];
  for (const entry of raw) {
    const r = itemSchema.safeParse(entry);
    if (r.success) out.push(r.data);
    if (out.length >= DETAILS_DISPLAY_CAP) break;
  }
  return out;
}

const MODE_LABEL: Record<string, string> = {
  official_api: "Official API",
  assisted_ingest: "Helper",
  manual_import: "Manual import",
};

export function modeLabel(provider: string): string {
  return MODE_LABEL[provider] ?? provider;
}

/** A RUNNING run that was expired on read ends FAILED with a fixed message. */
export function isAbandoned(run: Pick<RunRow, "status" | "error">): boolean {
  return run.status === "FAILED" && !!run.error?.startsWith(ABANDONED_TEXT);
}

/** finished − started; RUNNING shows elapsed time with an ellipsis; abandoned shows "timed out". */
export function runDurationText(
  run: Pick<RunRow, "status" | "error" | "startedAt" | "finishedAt">,
  now: Date,
): string {
  if (isAbandoned(run)) return "timed out";
  const start = new Date(run.startedAt).getTime();
  if (run.status === "RUNNING") return `${formatDuration(Math.max(now.getTime() - start, 0))}…`;
  if (!run.finishedAt) return "—";
  return formatDuration(new Date(run.finishedAt).getTime() - start);
}
