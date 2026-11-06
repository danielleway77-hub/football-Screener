import { AppError } from "@/server/errors";
import type { MatchProvider } from "./types";

/**
 * Mode A: a licensed/official data API (only if PrediGoal grants access). Recon has NOT chosen this mode yet,
 * so it refuses cleanly until PROVIDER_API_BASE / PROVIDER_API_KEY exist AND the response mapping
 * (src/server/providers/mapping.ts, to be written from the real API docs) is implemented. Credentials are
 * never logged.
 */
export const officialApiProvider: MatchProvider = {
  key: "official_api",
  canPull: true,
  async fetchWindow() {
    if (!process.env.PROVIDER_API_BASE || !process.env.PROVIDER_API_KEY) {
      throw new AppError(
        "PROVIDER_NOT_CONFIGURED",
        "The data provider is not set up yet. Use Import to send your matches instead.",
      );
    }
    throw new AppError(
      "PROVIDER_NOT_CONFIGURED",
      "The data provider connection has not been implemented yet.",
    );
  },
};
