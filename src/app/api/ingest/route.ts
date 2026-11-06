import { corsHeaders, preflight } from "@/server/cors";
import { handle, parseJson, readLimitedText, runResponse } from "@/server/http";
import { enforceIngestRateLimit } from "@/server/services/ingest-service";
import { processBatch } from "@/server/services/run-service";
import { getSettings } from "@/server/services/settings-service";
import { authenticateBearer } from "@/server/services/token-service";

export const maxDuration = 60;

const MAX_BYTES = 1024 * 1024; // 1 MB

export function OPTIONS(request: Request) {
  return preflight(request);
}

/** Helper / API entry: `Authorization: Bearer scr_…` + `{matches: […], percentScale?}`. */
export function POST(request: Request) {
  const cors = corsHeaders(request.headers.get("origin"));
  return handle(async () => {
    const now = new Date();
    const { tokenId } = await authenticateBearer(request.headers.get("authorization"), now);
    await enforceIngestRateLimit(tokenId, now);
    const body = parseJson(await readLimitedText(request, MAX_BYTES));
    const result = await processBatch({
      trigger: "INGEST",
      provider: "assisted_ingest",
      payload: body,
      settings: await getSettings(),
    });
    return runResponse(result, cors);
  }, cors);
}
