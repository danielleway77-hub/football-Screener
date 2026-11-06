import { handle, parseJson, readLimitedText, requireOwner, runResponse } from "@/server/http";
import { processBatch } from "@/server/services/run-service";
import { getSettings } from "@/server/services/settings-service";

export const maxDuration = 60;

const MAX_BYTES = 1024 * 1024;

/** Owner's Import page (smart paste / file): same payload and response as /api/ingest, trigger IMPORT. */
export function POST(request: Request) {
  return handle(async () => {
    await requireOwner(request, { mutating: true });
    const body = parseJson(await readLimitedText(request, MAX_BYTES));
    const result = await processBatch({
      trigger: "IMPORT",
      provider: "manual_import",
      payload: body,
      settings: await getSettings(),
    });
    return runResponse(result);
  });
}
