import pg from "pg";
import { schemaOf, stripPrismaParams } from "@/lib/pg-url";

/**
 * Seeding helpers for the dashboard e2e specs. They talk to the ISOLATED schema (the dev server is started
 * against it by playwright.config.ts) and refuse anything else. Times are relative to the real clock
 * because the app reads the real clock; the owner timezone is chosen so that local time is ~12:00 now,
 * which keeps "later today", "tomorrow" and "day after" on the intended local days at any hour.
 */
export const HOUR = 3_600_000;

/** Runs `fn` with a pg client on the isolated schema (raw SQL: the generated Prisma client is ESM-only). */
async function withClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const url = process.env.DIRECT_URL_TEST;
  if (!url || !/^test(_[a-z0-9]+)?$/.test(schemaOf(url))) {
    throw new Error(
      "e2e seeding refuses to run: DIRECT_URL_TEST must use schema test or test_<name>",
    );
  }
  const client = new pg.Client({
    connectionString: stripPrismaParams(url),
    options: `-c search_path=${schemaOf(url)} -c timezone=UTC`,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** A fixed-offset zone whose local time is 12:xx right now (Etc/GMT-3 means UTC+3). */
export function noonZone(now = new Date()): string {
  let offset = 12 - now.getUTCHours();
  if (offset > 12) offset -= 24;
  if (offset < -11) offset += 24;
  if (offset === 0) return "UTC";
  return `Etc/GMT${offset > 0 ? "-" : "+"}${Math.abs(offset)}`;
}

export type SeedMatch = {
  id: string;
  home: string;
  away: string;
  homePct: number;
  awayPct: number;
  /** Hours from now. */
  inHours: number;
  qualifies?: boolean;
  league?: string;
  country?: string;
  gap?: number;
  probabilities?: boolean;
};

export function baselineMatches(): SeedMatch[] {
  return [
    {
      id: "golden",
      home: "Sporting Cristal",
      away: "FC Cajamarca",
      homePct: 80,
      awayPct: 7,
      inHours: 24,
      league: "Liga 1",
      country: "Peru",
      probabilities: true,
    },
    {
      id: "atletico",
      home: "Atletico Madrid",
      away: "Bayern Munich",
      homePct: 44,
      awayPct: 56,
      inHours: 25,
      qualifies: false,
      league: "Champions League",
      country: "Europe",
    },
    {
      id: "today",
      home: "Today Home",
      away: "Today Away",
      homePct: 82,
      awayPct: 10,
      inHours: 3,
      league: "Premier League",
      country: "England",
    },
    {
      id: "dayafter",
      home: "Dayafter Home",
      away: "Dayafter Away",
      homePct: 12,
      awayPct: 91,
      inHours: 48,
      league: "La Liga",
      country: "Spain",
    },
    {
      id: "past",
      home: "Past Home",
      away: "Past Away",
      homePct: 85,
      awayPct: 5,
      inHours: -2,
      league: "Premier League",
      country: "England",
    },
  ];
}

export async function resetData() {
  await withClient(async (c) => {
    await c.query('DELETE FROM "RunMatch"');
    await c.query('DELETE FROM "Match"');
    await c.query('DELETE FROM "ScreeningRun"');
  });
}

export async function setSettings(patch: {
  accessMode?: "official_api" | "assisted_ingest" | "manual_import";
  windowDays?: number;
  staleAfterHrs?: number;
}) {
  await withClient(async (c) => {
    await c.query(
      'INSERT INTO "Setting" ("id","updatedAt") VALUES (1, now()) ON CONFLICT ("id") DO NOTHING',
    );
    await c.query(
      'UPDATE "Setting" SET "timezone" = $1, "accessMode" = COALESCE($2::"AccessMode", "accessMode"), "windowDays" = COALESCE($3, "windowDays"), "staleAfterHrs" = COALESCE($4, "staleAfterHrs") WHERE "id" = 1',
      [noonZone(), patch.accessMode ?? null, patch.windowDays ?? null, patch.staleAfterHrs ?? null],
    );
  });
}

export async function seedRun(opts: {
  status?: "SUCCESS" | "PARTIAL" | "FAILED" | "RUNNING";
  finishedHoursAgo?: number;
  scanned?: number;
  qualified?: number;
  failedCount?: number;
  error?: string;
}) {
  const ago = (opts.finishedHoursAgo ?? 1) * HOUR;
  const status = opts.status ?? "SUCCESS";
  await withClient((c) =>
    c.query(
      `INSERT INTO "ScreeningRun" ("id","trigger","provider","status","startedAt","finishedAt","scanned","qualified","failedCount","error") VALUES ($1,'MANUAL','e2e',$2::"RunStatus",$3::timestamptz,$4::timestamptz,$5,$6,$7,$8)`,
      [
        `run-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        status,
        new Date(Date.now() - ago - 5000).toISOString(),
        status === "RUNNING" ? null : new Date(Date.now() - ago).toISOString(),
        opts.scanned ?? 42,
        opts.qualified ?? 4,
        opts.failedCount ?? 0,
        opts.error ?? null,
      ],
    ),
  );
}

export async function seedMatches(list: SeedMatch[]) {
  const fetchedAt = new Date();
  await withClient(async (c) => {
    for (const m of list) {
      const q = m.qualifies ?? true;
      const p = m.probabilities;
      await c.query(
        `INSERT INTO "Match" ("id","provider","providerMatchId","kickoffAt","league","country","homeName","awayName","homeFormPct","awayFormPct","formScope","pHomeWin","pDraw","pAwayWin","pBtts","pOver25","predHomeGoals","predAwayGoals","qualifies","strongSide","formGap","fetchedAt","updatedAt") VALUES ($1,'e2e',$1,$2::timestamptz,$3,$4,$5,$6,$7,$8,'league',$9,$10,$11,$12,$13,$14,$15,$16,$17::"Side",$18,$19::timestamptz, now())`,
        [
          m.id,
          new Date(Date.now() + m.inHours * HOUR).toISOString(),
          m.league ?? "Test League",
          m.country ?? "Testland",
          m.home,
          m.away,
          m.homePct,
          m.awayPct,
          p ? 76 : null,
          p ? 16 : null,
          p ? 8 : null,
          p ? 54 : null,
          p ? 70 : null,
          p ? 3 : null,
          p ? 1 : null,
          q,
          q ? (m.homePct > m.awayPct ? "HOME" : "AWAY") : null,
          m.gap ?? Math.abs(m.homePct - m.awayPct),
          fetchedAt.toISOString(),
        ],
      );
    }
  });
}

/** Default dashboard state: a fresh SUCCESS run (1 h ago) and the baseline matches. */
export async function seedBaseline(
  mode: "official_api" | "assisted_ingest" | "manual_import" = "manual_import",
) {
  await resetData();
  await setSettings({ accessMode: mode, windowDays: 2, staleAfterHrs: 24 });
  await seedRun({ finishedHoursAgo: 1, scanned: 42, qualified: 3 });
  await seedMatches(baselineMatches());
}
