import type { MatchProvider } from "./types";

/** Mode C: the owner sends data through the Import page. Push-based: nothing to pull. */
export const manualImportProvider: MatchProvider = { key: "manual_import", canPull: false };
