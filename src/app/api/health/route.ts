import { hasValidSession } from "@/server/auth/guard";
import { handle, json } from "@/server/http";
import * as health from "@/server/repositories/health";
import * as runs from "@/server/repositories/runs";

/** Public: `{ok, db}` only. With a valid session also `{lastRunAt, lastStatus}`. Never secrets or data counts. */
export function GET() {
  return handle(async () => {
    const db = await health.ping(2000);
    const base = { ok: db, db };
    if (!db || !(await hasValidSession().catch(() => false))) return json(base);
    const last = (await runs.list({ pageSize: 1 })).items[0];
    return json({
      ...base,
      lastRunAt: last?.finishedAt ?? last?.startedAt ?? null,
      lastStatus: last?.status ?? null,
    });
  });
}
