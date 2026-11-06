import { handle, json, parseJson, readLimitedText, requireOwner } from "@/server/http";
import { getSettings, saveSettings, toPublicSettings } from "@/server/services/settings-service";

export function GET(request: Request) {
  return handle(async () => {
    await requireOwner(request, { mutating: false });
    return json({ settings: toPublicSettings(await getSettings()) });
  });
}

/**
 * Saves a (partial) settings update. Changed thresholds are re-applied to the stored matches in the same
 * request: the answer carries `rescreen: {changed, qualifying}` (or `rescreenSkipped` with the reason).
 */
export function PUT(request: Request) {
  return handle(async () => {
    await requireOwner(request, { mutating: true });
    const body = parseJson(await readLimitedText(request, 4096));
    return json(await saveSettings(body));
  });
}
