import { getProvider } from "@/server/providers";
import { AppError } from "@/server/errors";
import { handle, json, requireOwner } from "@/server/http";
import { pullAndProcess } from "@/server/services/run-service";
import { getSettings } from "@/server/services/settings-service";

export const maxDuration = 60;

/** "Run now": only for modes that can pull. Others get 409 and use Update data / Import instead. */
export function POST(request: Request) {
  return handle(async () => {
    await requireOwner(request, { mutating: true });
    const settings = await getSettings();
    if (!getProvider(settings.accessMode).canPull) {
      throw new AppError("MODE_NOT_SUPPORTED", "Use Update data / Import for your access mode.");
    }
    const result = await pullAndProcess({ trigger: "MANUAL", settings });
    // An already-running run is returned as-is (202), so repeated clicks are harmless.
    return json({ runId: result.runId, status: result.status }, 202);
  });
}
