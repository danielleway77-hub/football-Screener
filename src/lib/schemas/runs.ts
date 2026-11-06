import { z } from "zod";

export const RUNS_PAGE_SIZE = 20;
/** Upper bound for the `page` URL param (a larger value is clamped, never an error). */
export const MAX_PAGE = 10_000;
export const STATUS_FILTERS = ["SUCCESS", "PARTIAL", "FAILED", "RUNNING"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export type RunsParams = { page: number; status: StatusFilter | null; showSkipped: boolean };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const schema = z.object({
  page: z.coerce.number().int().min(1).max(MAX_PAGE).catch(1),
  status: z.enum(STATUS_FILTERS).nullable().catch(null),
  showSkipped: z
    .enum(["1", "true"])
    .transform(() => true)
    .catch(false),
});

/** Validated Runs page search params; anything invalid falls back to the default (page 1, all, skipped hidden). */
export function parseRunsParams(raw: Record<string, string | string[] | undefined>): RunsParams {
  return schema.parse({
    page: first(raw.page) ?? 1,
    status: first(raw.status) ?? null,
    showSkipped: first(raw.showSkipped),
  });
}

/** Builds `/runs?...` for the given params (defaults are omitted). */
export function runsHref(p: Partial<RunsParams>): string {
  const q = new URLSearchParams();
  if (p.status) q.set("status", p.status);
  if (p.showSkipped) q.set("showSkipped", "1");
  if (p.page && p.page > 1) q.set("page", String(p.page));
  const s = q.toString();
  return s ? `/runs?${s}` : "/runs";
}
