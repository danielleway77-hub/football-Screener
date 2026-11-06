import { handle, json, requireOwner } from "@/server/http";
import { rescreenStored } from "@/server/services/settings-service";

export const maxDuration = 60;

/** Re-evaluates every stored match with the saved thresholds (atomic; refused while an update runs). */
export function POST(request: Request) {
  return handle(async () => {
    await requireOwner(request, { mutating: true });
    return json(await rescreenStored());
  });
}
