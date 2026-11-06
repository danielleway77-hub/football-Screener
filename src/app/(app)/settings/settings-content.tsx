import { SettingsView } from "@/components/settings/SettingsView";
import { listTokens } from "@/server/services/token-service";
import {
  countStoredMatches,
  getSettings,
  toPublicSettings,
} from "@/server/services/settings-service";

/** Reads settings, tokens and the stored-match count at request time (inside Suspense). */
export async function SettingsContent() {
  const [settings, tokens, storedCount] = await Promise.all([
    getSettings(),
    listTokens(),
    countStoredMatches(),
  ]);
  return (
    <SettingsView
      settings={toPublicSettings(settings)}
      tokens={tokens.map((t) => ({
        id: t.id,
        label: t.label,
        createdAt: t.createdAt.toISOString(),
        lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
        revokedAt: t.revokedAt?.toISOString() ?? null,
      }))}
      storedCount={storedCount}
      officialApiConfigured={Boolean(process.env.PROVIDER_API_BASE && process.env.PROVIDER_API_KEY)}
    />
  );
}
