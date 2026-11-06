import { ImportView } from "@/components/import/ImportView";
import { formatRunTime } from "@/lib/format";
import * as runsRepo from "@/server/repositories/runs";
import { getSettings } from "@/server/services/settings-service";

/** Reads the settings and the latest helper update at request time (inside Suspense). */
export async function ImportContent() {
  const [settings, last] = await Promise.all([
    getSettings(),
    runsRepo.getLatestByTrigger("INGEST"),
  ]);
  const lastIngest = last
    ? `Last update: ${formatRunTime(last.startedAt, new Date(), settings.timezone)} · ${last.status} · ${last.scanned} matches`
    : null;
  return (
    <ImportView
      accessMode={settings.accessMode}
      formScope={settings.formScope}
      high={settings.highThreshold}
      low={settings.lowThreshold}
      timezone={settings.timezone}
      lastIngest={lastIngest}
    />
  );
}
