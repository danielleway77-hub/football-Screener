import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { signSessionToken } from "@/server/auth/jwt";
import { bttsNo, under25 } from "@/server/domain/screening";
import * as settingsRepo from "@/server/repositories/settings";
import { getDashboard, getMatch, getRunStats } from "@/server/services/match-service";
import { createToken } from "@/server/services/token-service";
import { setupTestDb } from "./helpers";

/**
 * Client acceptance examples through the REAL pipeline: HTTP route handlers (ingest, settings, import)
 * -> run service -> Postgres (isolated schema) -> dashboard/detail services. No mocks below the routes.
 */

const SECRET = "s".repeat(40);
const ORIGIN = "http://localhost:3000";
const NOW = new Date("2026-11-03T12:00:00Z");
let cookieValue: string | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (cookieValue ? { value: cookieValue } : undefined),
    set: vi.fn(),
  }),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => undefined,
}));
vi.mock("next/navigation", () => ({
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));

setupTestDb();

beforeEach(async () => {
  vi.stubEnv("SESSION_SECRET", SECRET);
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("INGEST_ALLOWED_ORIGINS", "https://predigoal.com");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", ORIGIN);
  cookieValue = undefined;
  await settingsRepo.ensureSettings();
  const s = await settingsRepo.getSettings();
  cookieValue = await signSessionToken(s.sessionVersion, SECRET);
});

const item = (id: string, home: number, away: number, kickoffAt = "2026-11-04T19:45:00Z") => ({
  provider: "predigoal",
  providerMatchId: id,
  kickoffAt,
  league: "Liga 1",
  home: { name: `Home ${id}`, formPct: home },
  away: { name: `Away ${id}`, formPct: away },
  formScope: "league",
  probabilities: { homeWin: 76, draw: 16, awayWin: 8, btts: 54, over25: 70 },
  predictedScore: { home: 3, away: 1 },
});

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  });
}

async function ingest(matches: unknown[]) {
  const { token } = await createToken("acceptance");
  const { POST } = await import("@/app/api/ingest/route");
  const res = await POST(
    post("/api/ingest", { matches }, { authorization: `Bearer ${token}`, origin: "" }),
  );
  return { res, body: (await res.json()) as Record<string, unknown> };
}

async function putSettings(patch: unknown) {
  const { PUT } = await import("@/app/api/settings/route");
  const res = await PUT(
    new Request(`${ORIGIN}/api/settings`, {
      method: "PUT",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify(patch),
    }),
  );
  return { res, body: (await res.json()) as Record<string, unknown> };
}

const qualifying = async (tab: "upcoming" | "tomorrow" = "upcoming") =>
  (await getDashboard({ tab }, await settingsRepo.getSettings(), NOW)).map(
    (m) => m.providerMatchId,
  );

describe("client acceptance examples (route -> pipeline -> DB -> dashboard)", () => {
  it("Sporting Cristal 80 / FC Cajamarca 7 qualifies (strong HOME) with win 76/draw 16/away 8, BTTS 54/46, Over 70/Under 30, predicted 3-1", async () => {
    const sc = {
      ...item("1549544", 80, 7),
      league: "Liga 1 Peru",
      home: { name: "Sporting Cristal", formPct: 80 },
      away: { name: "FC Cajamarca", formPct: 7 },
    };
    const { res, body } = await ingest([sc]);
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ status: "SUCCESS", scanned: 1, qualified: 1, failed: 0 });

    const settings = await settingsRepo.getSettings();
    const list = await getDashboard({ tab: "tomorrow" }, settings, NOW);
    expect(list).toHaveLength(1);
    const detail = await getMatch(list[0]!.id, NOW);
    const m = detail!.match;
    expect(m).toMatchObject({
      homeName: "Sporting Cristal",
      awayName: "FC Cajamarca",
      homeFormPct: 80,
      awayFormPct: 7,
      qualifies: true,
      strongSide: "HOME",
      pHomeWin: 76,
      pDraw: 16,
      pAwayWin: 8,
      pBtts: 54,
      pOver25: 70,
      predHomeGoals: 3,
      predAwayGoals: 1,
    });
    expect(bttsNo({ btts: m.pBtts ?? undefined })).toBe(46);
    expect(under25({ over25: m.pOver25 ?? undefined })).toBe(30);
  });

  it("Atletico 44 / Bayern 56 does not qualify; 75/35 does not; 76/34 does; away-strong 30/82 does", async () => {
    const { body } = await ingest([
      item("atm", 44, 56),
      item("edge", 75, 35),
      item("in", 76, 34),
      item("away", 30, 82),
    ]);
    expect(body).toMatchObject({ scanned: 4, qualified: 2, failed: 0 });
    expect((await qualifying()).sort()).toEqual(["away", "in"]);
    const stored = await getDb().match.findMany({ where: { providerMatchId: "away" } });
    expect(stored[0]).toMatchObject({ qualifies: true, strongSide: "AWAY" });
  });

  it("changing the thresholds to 70/40 through PUT /api/settings re-screens the stored matches", async () => {
    await ingest([item("a", 72, 38), item("b", 80, 7), item("c", 76, 34)]);
    expect((await qualifying()).sort()).toEqual(["b", "c"]);
    const { res, body } = await putSettings({ highThreshold: 70, lowThreshold: 40 });
    expect(res.status).toBe(200);
    expect(body).toHaveProperty("rescreen");
    expect((await qualifying()).sort()).toEqual(["a", "b", "c"]);
    await putSettings({ highThreshold: 75, lowThreshold: 35 });
    expect((await qualifying()).sort()).toEqual(["b", "c"]);
  });

  it("duplicate ingest is idempotent: same payload 3x keeps one row per match", async () => {
    for (let i = 0; i < 3; i++) await ingest([item("dup", 80, 7)]);
    expect(await getDb().match.count()).toBe(1);
    expect(await qualifying()).toEqual(["dup"]);
  });

  it("kickoff window in Europe/London on DST days: tomorrow = 25 h on 2026-10-25 and 23 h on 2026-03-29", async () => {
    const autumn = new Date("2026-10-24T12:00:00Z");
    await ingest([
      item("before", 80, 7, "2026-10-24T22:30:00Z"), // 23:30 BST on the 24th: today
      item("start", 80, 7, "2026-10-24T23:30:00Z"), // 00:30 BST on the 25th: tomorrow
      item("end", 80, 7, "2026-10-25T23:30:00Z"), // 23:30 GMT on the 25th: tomorrow (25 h day)
      item("after", 80, 7, "2026-10-26T00:00:00Z"), // 00:00 GMT on the 26th: day after
    ]);
    const s = await settingsRepo.getSettings();
    const ids = async (n: Date, tab: "tomorrow" | "dayafter") =>
      (await getDashboard({ tab }, s, n)).map((m) => m.providerMatchId).sort();
    expect(await ids(autumn, "tomorrow")).toEqual(["end", "start"]);
    expect(await ids(autumn, "dayafter")).toEqual(["after"]);

    await getDb().match.deleteMany();
    const spring = new Date("2026-03-28T12:00:00Z");
    await ingest([
      item("s-in", 80, 7, "2026-03-28T23:30:00Z"), // 23:30 GMT on the 28th: today
      item("s-start", 80, 7, "2026-03-29T00:00:00Z"), // 00:00 GMT on the 29th: tomorrow
      item("s-end", 80, 7, "2026-03-29T22:59:00Z"), // 23:59 BST on the 29th: tomorrow (23 h day)
      item("s-next", 80, 7, "2026-03-29T23:00:00Z"), // 00:00 BST on the 30th: day after
    ]);
    expect(await ids(spring, "tomorrow")).toEqual(["s-end", "s-start"]);
    expect(await ids(spring, "dayafter")).toEqual(["s-next"]);
  });

  it("stale data: stale after staleAfterHrs (26 h default), fresh after a run, stale with no run", async () => {
    expect((await getRunStats(await settingsRepo.getSettings(), NOW)).stale).toBe(true);
    await ingest([item("x", 80, 7)]);
    const s = await settingsRepo.getSettings();
    const finished = (await getRunStats(s, new Date())).lastUpdate!;
    const at = (hrs: number) => new Date(finished.getTime() + hrs * 3_600_000);
    expect((await getRunStats(s, at(25))).stale).toBe(false);
    expect((await getRunStats(s, at(27))).stale).toBe(true);
  });
});
