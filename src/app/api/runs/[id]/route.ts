import { AppError } from "@/server/errors";
import { handle, json, requireOwner } from "@/server/http";
import * as runs from "@/server/repositories/runs";
import { ABANDONED_RUN_MINUTES } from "@/server/services/run-service";

/** Run status for polling. Abandoned runs are expired on read so the UI never polls a dead run forever. */
export function GET(request: Request, ctx: RouteContext<"/api/runs/[id]">) {
  return handle(async () => {
    await requireOwner(request, { mutating: false });
    const { id } = await ctx.params;
    await runs.expireAbandoned(ABANDONED_RUN_MINUTES, new Date());
    const run = await runs.getById(id);
    if (!run) throw new AppError("NOT_FOUND", "Run not found.");
    return json({
      id: run.id,
      status: run.status,
      trigger: run.trigger,
      scanned: run.scanned,
      qualified: run.qualified,
      failedCount: run.failedCount,
      error: run.error,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
    });
  });
}
