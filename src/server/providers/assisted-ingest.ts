import type { MatchProvider } from "./types";

/** Mode B: the owner's own browser (userscript) posts data to /api/ingest. Push-based: nothing to pull. */
export const assistedIngestProvider: MatchProvider = { key: "assisted_ingest", canPull: false };
