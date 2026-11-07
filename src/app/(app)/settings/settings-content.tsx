import { SettingsView } from "@/components/settings/SettingsView";
import { getDb } from "@/lib/db";
import { listTokens } from "@/server/services/token-service";
import {
  countStoredMatches,
  getSettings,
  toPublicSettings,
} from "@/server/services/settings-service";

/** Form values of the most recent stored matches: only used for the live "would qualify" preview. */
async function listFormPairs(): Promise<[number, number][]> {
  const rows = await getDb().match.findMany({
    select: { homeFormPct: true, awayFormPct: true },
    orderBy: { kickoffAt: "desc" },
    take: 2000,
  });
  return rows.map((r) => [r.homeFormPct, r.awayFormPct]);
}

/** Reads settings, tokens and the stored-match count at request time (inside Suspense). */
export async function SettingsContent() {
  const [settings, tokens, storedCount, formPairs] = await Promise.all([
    getSettings(),
    listTokens(),
    countStoredMatches(),
    listFormPairs(),
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
      formPairs={formPairs}
      officialApiConfigured={Boolean(process.env.PROVIDER_API_BASE && process.env.PROVIDER_API_KEY)}
    />
  );
}
