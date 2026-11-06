import type { RawMatchInput } from "@/server/domain/types";
import type { AccessMode, SettingRecord } from "@/server/repositories/types";

/**
 * How match data arrives. Push providers (assisted ingest, manual import) only validate what is sent to us;
 * a pull provider (official API) fetches the window itself. Every provider ends in the same run service.
 */
export interface MatchProvider {
  key: AccessMode;
  canPull: boolean;
  fetchWindow?(
    range: { from: Date; to: Date },
    ctx: { settings: SettingRecord; signal: AbortSignal },
  ): Promise<RawMatchInput[]>;
}
