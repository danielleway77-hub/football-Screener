import { AppError } from "@/server/errors";
import type { AccessMode } from "@/server/repositories/types";
import { assistedIngestProvider } from "./assisted-ingest";
import { manualImportProvider } from "./manual-import";
import { officialApiProvider } from "./official-api";
import type { MatchProvider } from "./types";

export type { MatchProvider } from "./types";

export function getProvider(mode: AccessMode): MatchProvider {
  switch (mode) {
    case "manual_import":
      return manualImportProvider;
    case "assisted_ingest":
      return assistedIngestProvider;
    case "official_api":
      return officialApiProvider;
    default:
      throw new AppError("INTERNAL", "Unknown access mode.");
  }
}
