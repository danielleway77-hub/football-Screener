import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { signSessionToken } from "@/server/auth/jwt";
import * as runs from "@/server/repositories/runs";
import * as settingsRepo from "@/server/repositories/settings";
import { hashToken, createToken, revokeToken } from "@/server/services/token-service";
import { setupTestDb } from "./helpers";

const SECRET = "s".repeat(40);
const ORIGIN = "http://localhost:3000";
let cookieValue: string | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (cookieValue ? { value: cookieValue } : undefined),
    set: vi.fn(),
  }),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => undefined, // outside a Next request scope in unit tests
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
  vi.stubEnv("INGEST_ALLOWED_ORIGINS", "https://predigoal.com,https://app.example.com");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", ORIGIN);
  cookieValue = undefined;
  await settingsRepo.ensureSettings();
});

async function signIn() {
  const s = await settingsRepo.getSettings();
  cookieValue = await signSessionToken(s.sessionVersion, SECRET);
}

const match = (id: string, home = 80, away = 7) => ({
  provider: "predigoal",
  providerMatchId: id,
  kickoffAt: "2026-11-04T15:00:00Z",
  home: { name: `H${id}`, formPct: home },
  away: { name: `A${id}`, formPct: away },
  formScope: "league",
  probabilities: { homeWin: 76, draw: 16, awayWin: 8, btts: 54, over25: 70 },
  predictedScore: { home: 3, away: 1 },
});

function req(
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
) {
  const body =
    init.body === undefined
      ? undefined
      : typeof init.body === "string"
        ? init.body
        : JSON.stringify(init.body);
  return new Request(`${ORIGIN}${path}`, {
    method: init.method ?? "POST",
    headers: { "content-type": "application/json", ...init.headers },
    body,
  });
}

const ingest = async (r: Request) => (await import("@/app/api/ingest/route")).POST(r);
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

describe("POST /api/ingest — authentication", () => {
  const bodies = async (res: Response) => JSON.stringify(await res.json());

  it("no header, malformed header, wrong token and revoked token all give the same 401", async () => {
    const good = await createToken("helper");
    await revokeToken((await getDb().ingestToken.findFirstOrThrow()).id);
    const cases = [
      {},
      { authorization: "Basic abc" },
      { authorization: "Bearer" },
      { authorization: "Bearer not-a-token" },
      bearer("scr_" + "A".repeat(43)), // well-formed but unknown
      bearer(good.token), // revoked
    ];
    const seen = new Set<string>();
    for (const headers of cases) {
      const res = await ingest(req("/api/ingest", { headers, body: { matches: [match("1")] } }));
      expect(res.status, JSON.stringify(headers)).toBe(401);
      seen.add(await bodies(res));
    }
    expect(seen.size).toBe(1); // nothing distinguishes the failure reasons
    expect(await getDb().match.count()).toBe(0);
  });

  it("a valid token stores the match and updates lastUsedAt; the response never contains the token", async () => {
    const { token, id } = await createToken("helper");
    const res = await ingest(
      req("/api/ingest", {
        headers: bearer(token),
        body: { matches: [match("1"), match("2", 40, 40)] },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const text = await res.text();
    expect(text).not.toContain(token);
    expect(JSON.parse(text)).toMatchObject({
      status: "SUCCESS",
      scanned: 2,
      qualified: 1,
      failed: 0,
    });
    expect(await getDb().match.count()).toBe(2);
    expect(
      (await getDb().ingestToken.findUniqueOrThrow({ where: { id } })).lastUsedAt,
    ).not.toBeNull();
  });

  it("only the sha256 hash of the token is stored", async () => {
    const { token } = await createToken("helper");
    const row = await getDb().ingestToken.findFirstOrThrow();
    expect(row.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
  });
});

describe("POST /api/ingest — limits and validation", () => {
  it("the 31st request within an hour is 429 with Retry-After", async () => {
    const { token, id } = await createToken("helper");
    const hour = new Date();
    hour.setUTCMinutes(0, 0, 0);
    await getDb().rateLimit.create({
      data: {
        key: `ingest:${id}:${hour.toISOString().slice(0, 13)}`,
        count: 30,
        windowStart: hour,
      },
    });
    const res = await ingest(
      req("/api/ingest", { headers: bearer(token), body: { matches: [match("1")] } }),
    );
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await res.json()).error.code).toBe("RATE_LIMITED");
  });

  it("the 30th request is still accepted", async () => {
    const { token, id } = await createToken("helper");
    const hour = new Date();
    hour.setUTCMinutes(0, 0, 0);
    await getDb().rateLimit.create({
      data: {
        key: `ingest:${id}:${hour.toISOString().slice(0, 13)}`,
        count: 29,
        windowStart: hour,
      },
    });
    const res = await ingest(
      req("/api/ingest", { headers: bearer(token), body: { matches: [match("1")] } }),
    );
    expect(res.status).toBe(200);
  });

  it("a body over 1 MB is 413 (declared length)", async () => {
    const { token } = await createToken("helper");
    const res = await ingest(
      req("/api/ingest", {
        headers: { ...bearer(token), "content-length": String(2 * 1024 * 1024) },
        body: "{}",
      }),
    );
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("a streamed body over 1 MB without content-length is 413 as well", async () => {
    const { token } = await createToken("helper");
    const big = JSON.stringify({ matches: [], pad: "x".repeat(1024 * 1024 + 10) });
    const res = await ingest(req("/api/ingest", { headers: bearer(token), body: big }));
    expect(res.status).toBe(413);
  });

  it("invalid JSON, wrong shape and empty matches are 422", async () => {
    const { token } = await createToken("helper");
    for (const body of ["{not json", { nope: 1 }, { matches: [] }, { matches: "x" }]) {
      const res = await ingest(req("/api/ingest", { headers: bearer(token), body }));
      expect(res.status, JSON.stringify(body)).toBe(422);
      expect((await res.json()).error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("when every item is invalid it is 422 with the run id and nothing is stored", async () => {
    const { token } = await createToken("helper");
    const res = await ingest(
      req("/api/ingest", {
        headers: bearer(token),
        body: { matches: [{}, { providerMatchId: "x" }] },
      }),
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.runId).toBeTruthy();
    expect(await getDb().match.count()).toBe(0);
  });

  it("a partially valid payload is 200 PARTIAL", async () => {
    const { token } = await createToken("helper");
    const res = await ingest(
      req("/api/ingest", {
        headers: bearer(token),
        body: { matches: [match("ok"), { providerMatchId: "bad" }] },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "PARTIAL", failed: 1 });
  });

  it("is 409 RUN_IN_PROGRESS while another run is RUNNING", async () => {
    const { token } = await createToken("helper");
    await runs.createRunning({ trigger: "CRON", provider: "t" });
    const res = await ingest(
      req("/api/ingest", { headers: bearer(token), body: { matches: [match("1")] } }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("RUN_IN_PROGRESS");
  });

  it("is idempotent: the same payload twice keeps one row", async () => {
    const { token } = await createToken("helper");
    const body = { matches: [match("1")] };
    await ingest(req("/api/ingest", { headers: bearer(token), body }));
    await ingest(req("/api/ingest", { headers: bearer(token), body }));
    expect(await getDb().match.count()).toBe(1);
  });
});

describe("/api/ingest — CORS", () => {
  it("echoes an allowed Origin (with Vary) and never a disallowed one", async () => {
    const { token } = await createToken("helper");
    const ok = await ingest(
      req("/api/ingest", {
        headers: { ...bearer(token), origin: "https://predigoal.com" },
        body: { matches: [match("1")] },
      }),
    );
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://predigoal.com");
    expect(ok.headers.get("vary")).toContain("Origin");
    expect(ok.headers.get("access-control-allow-credentials")).toBeNull();
    const evil = await ingest(
      req("/api/ingest", {
        headers: { ...bearer(token), origin: "https://evil.com" },
        body: { matches: [match("2")] },
      }),
    );
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
    expect(evil.headers.get("vary")).toContain("Origin");
  });

  it("a request with no Origin and a valid token works and gets no ACAO header", async () => {
    const { token } = await createToken("helper");
    const res = await ingest(
      req("/api/ingest", { headers: bearer(token), body: { matches: [match("1")] } }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("errors carry the CORS headers too (so the page can read a 401)", async () => {
    const res = await ingest(
      req("/api/ingest", { headers: { origin: "https://predigoal.com" }, body: {} }),
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://predigoal.com");
  });

  it("preflight: allowed origin → 204 with exact headers; disallowed → 403 without ACAO", async () => {
    const { OPTIONS } = await import("@/app/api/ingest/route");
    const ok = OPTIONS(
      req("/api/ingest", { method: "OPTIONS", headers: { origin: "https://app.example.com" } }),
    );
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
    expect(ok.headers.get("access-control-allow-headers")).toBe("authorization, content-type");
    expect(ok.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
    expect(ok.headers.get("access-control-max-age")).toBe("600");
    const bad = OPTIONS(
      req("/api/ingest", { method: "OPTIONS", headers: { origin: "https://evil.com" } }),
    );
    expect(bad.status).toBe(403);
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
    const none = OPTIONS(req("/api/ingest", { method: "OPTIONS" }));
    expect(none.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("session-protected routes", () => {
  it("import: 401 without a session, 403 cross-origin, 200 with a session", async () => {
    const { POST } = await import("@/app/api/import/route");
    const body = { matches: [match("1")] };
    expect((await POST(req("/api/import", { body, headers: { origin: ORIGIN } }))).status).toBe(
      401,
    );
    await signIn();
    expect(
      (await POST(req("/api/import", { body, headers: { origin: "https://evil.com" } }))).status,
    ).toBe(403);
    expect((await POST(req("/api/import", { body }))).status).toBe(403); // no Origin at all
    const ok = await POST(req("/api/import", { body, headers: { origin: ORIGIN } }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ status: "SUCCESS", scanned: 1 });
    expect((await getDb().screeningRun.findFirstOrThrow()).trigger).toBe("IMPORT");
  });

  it("a stale session (sessionVersion bumped) is refused by the route even though the JWT is valid", async () => {
    const { POST } = await import("@/app/api/import/route");
    await signIn();
    await settingsRepo.bumpSessionVersion();
    const res = await POST(
      req("/api/import", { body: { matches: [match("1")] }, headers: { origin: ORIGIN } }),
    );
    expect(res.status).toBe(401);
  });

  it("run: 401 without a session; 409 MODE_NOT_SUPPORTED in a push-only mode", async () => {
    const { POST } = await import("@/app/api/run/route");
    expect((await POST(req("/api/run", { headers: { origin: ORIGIN } }))).status).toBe(401);
    await signIn();
    const res = await POST(req("/api/run", { headers: { origin: ORIGIN } }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: {
        code: "MODE_NOT_SUPPORTED",
        message: "Use Update data / Import for your access mode.",
      },
    });
  });

  it("run: the official-api mode answers 503 PROVIDER_NOT_CONFIGURED", async () => {
    vi.stubEnv("PROVIDER_API_BASE", "");
    vi.stubEnv("PROVIDER_API_KEY", "");
    await settingsRepo.updateSettings({ accessMode: "official_api" });
    await signIn();
    const { POST } = await import("@/app/api/run/route");
    const res = await POST(req("/api/run", { headers: { origin: ORIGIN } }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("PROVIDER_NOT_CONFIGURED");
  });

  it("runs/[id]: 401, 404, 200 shape, and abandoned runs are expired on read", async () => {
    const { GET } = await import("@/app/api/runs/[id]/route");
    const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as Parameters<typeof GET>[1];
    expect((await GET(req("/api/runs/x", { method: "GET" }), ctx("x"))).status).toBe(401);
    await signIn();
    expect((await GET(req("/api/runs/nope", { method: "GET" }), ctx("nope"))).status).toBe(404);
    const old = await getDb().screeningRun.create({
      data: {
        trigger: "CRON",
        provider: "t",
        status: "RUNNING",
        startedAt: new Date(Date.now() - 11 * 60_000),
      },
    });
    const res = await GET(req(`/api/runs/${old.id}`, { method: "GET" }), ctx(old.id));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Object.keys(json).sort()).toEqual([
      "error",
      "failedCount",
      "finishedAt",
      "id",
      "qualified",
      "scanned",
      "startedAt",
      "status",
      "trigger",
    ]);
    expect(json.status).toBe("FAILED");
  });
});

describe("GET /api/health", () => {
  it("public shape is exactly {ok, db}; with a session it adds lastRunAt/lastStatus; no secrets", async () => {
    const { GET } = await import("@/app/api/health/route");
    const anon = await (await GET()).json();
    expect(anon).toEqual({ ok: true, db: true });
    await signIn();
    const { token } = await createToken("x");
    await runs.createRunning({ trigger: "CRON", provider: "t" });
    const authed = await (await GET()).json();
    expect(Object.keys(authed).sort()).toEqual(["db", "lastRunAt", "lastStatus", "ok"]);
    expect(authed.lastStatus).toBe("RUNNING");
    expect(JSON.stringify(authed)).not.toContain(token);
  });
});

describe("/api/tokens", () => {
  it("create returns the plaintext once; list never does; revoke is idempotent", async () => {
    const tokensRoute = await import("@/app/api/tokens/route");
    const idRoute = await import("@/app/api/tokens/[id]/route");
    expect(
      (
        await tokensRoute.POST(
          req("/api/tokens", { body: { label: "x" }, headers: { origin: ORIGIN } }),
        )
      ).status,
    ).toBe(401);
    await signIn();
    const created = await tokensRoute.POST(
      req("/api/tokens", { body: { label: "  Laptop  " }, headers: { origin: ORIGIN } }),
    );
    expect(created.status).toBe(201);
    const { id, label, token } = await created.json();
    expect(label).toBe("Laptop");
    expect(token).toMatch(/^scr_[A-Za-z0-9_-]{43}$/);

    const list = await tokensRoute.GET(req("/api/tokens", { method: "GET" }));
    const text = await list.text();
    expect(text).not.toContain(token);
    expect(text).not.toContain("tokenHash");
    expect(JSON.parse(text).tokens).toHaveLength(1);

    const ctx = { params: Promise.resolve({ id }) } as Parameters<typeof idRoute.DELETE>[1];
    expect(
      (
        await idRoute.DELETE(
          req(`/api/tokens/${id}`, { method: "DELETE", headers: { origin: ORIGIN } }),
          ctx,
        )
      ).status,
    ).toBe(204);
    const first = (await getDb().ingestToken.findUniqueOrThrow({ where: { id } })).revokedAt;
    expect(
      (
        await idRoute.DELETE(
          req(`/api/tokens/${id}`, { method: "DELETE", headers: { origin: ORIGIN } }),
          ctx,
        )
      ).status,
    ).toBe(204);
    expect((await getDb().ingestToken.findUniqueOrThrow({ where: { id } })).revokedAt).toEqual(
      first,
    );
    const missing = { params: Promise.resolve({ id: "nope" }) } as Parameters<
      typeof idRoute.DELETE
    >[1];
    expect(
      (
        await idRoute.DELETE(
          req("/api/tokens/nope", { method: "DELETE", headers: { origin: ORIGIN } }),
          missing,
        )
      ).status,
    ).toBe(404);
    // a revoked token no longer works
    const use = await ingest(
      req("/api/ingest", { headers: bearer(token), body: { matches: [match("1")] } }),
    );
    expect(use.status).toBe(401);
  });

  it("label must be 1–40 characters", async () => {
    const { POST } = await import("@/app/api/tokens/route");
    await signIn();
    for (const label of ["", "   ", "x".repeat(41)]) {
      const res = await POST(req("/api/tokens", { body: { label }, headers: { origin: ORIGIN } }));
      expect(res.status, label).toBe(422);
      expect((await res.json()).error.fieldErrors.label).toBeTruthy();
    }
    expect((await POST(req("/api/tokens", { body: {}, headers: { origin: ORIGIN } }))).status).toBe(
      422,
    );
  });
});

describe("pipeline hardening (review fixes)", () => {
  it("a NUL character or lone surrogate in one field does not break the batch", async () => {
    const { token } = await createToken("helper");
    const dirty = { ...match("dirty"), league: "Liga\u0000 Uno \ud800" };
    const res = await ingest(
      req("/api/ingest", { headers: bearer(token), body: { matches: [dirty, match("clean")] } }),
    );
    expect(res.status).toBe(200);
    expect(await getDb().match.count()).toBe(2);
    expect(
      (await getDb().match.findFirstOrThrow({ where: { providerMatchId: "dirty" } })).league,
    ).toBe("Liga Uno �");
  });

  it("storeBatch refuses a run that was expired meanwhile (no data from a cancelled run)", async () => {
    const matches = await import("@/server/repositories/matches");
    const old = await getDb().screeningRun.create({
      data: {
        trigger: "CRON",
        provider: "t",
        status: "RUNNING",
        startedAt: new Date(Date.now() - 11 * 60_000),
      },
    });
    await runs.expireAbandoned(10, new Date());
    const row = {
      input: {
        provider: "x",
        providerMatchId: "late",
        sourceUrl: null,
        kickoffAt: new Date(),
        league: null,
        country: null,
        homeName: "H",
        awayName: "A",
        homeLogoUrl: null,
        awayLogoUrl: null,
        homeFormPct: 80,
        awayFormPct: 7,
        formScope: "league" as const,
        homeLastResults: null,
        awayLastResults: null,
        pHomeWin: null,
        pDraw: null,
        pAwayWin: null,
        pBtts: null,
        pOver25: null,
        predHomeGoals: null,
        predAwayGoals: null,
        confidence: null,
        qualifies: true,
        strongSide: "HOME" as const,
        formGap: 73,
        lastRunId: null,
        fetchedAt: new Date(),
      },
      qualifiedAtRun: true,
    };
    await expect(matches.storeBatch([row], old.id)).rejects.toThrow(matches.RUN_NOT_RUNNING);
    expect(await getDb().match.count()).toBe(0);
  });

  it("expiry boundary: a run exactly 10 minutes old is left alone, 10 min + 1 s is expired", async () => {
    const now = new Date("2026-11-03T12:00:00Z");
    const mk = (secondsAgo: number) =>
      getDb().screeningRun.create({
        data: {
          trigger: "CRON",
          provider: "t",
          status: "RUNNING",
          startedAt: new Date(now.getTime() - secondsAgo * 1000),
        },
      });
    const exact = await mk(600);
    expect(await runs.expireAbandoned(10, now)).toBe(0);
    expect((await runs.getById(exact.id))?.status).toBe("RUNNING");
    await getDb().screeningRun.update({
      where: { id: exact.id },
      data: { startedAt: new Date(now.getTime() - 601_000) },
    });
    expect(await runs.expireAbandoned(10, now)).toBe(1);
  });

  it("rescreenAll refuses while a run is in progress", async () => {
    const { rescreenAll } = await import("@/server/services/run-service");
    await runs.createRunning({ trigger: "CRON", provider: "t" });
    await expect(rescreenAll(await settingsRepo.getSettings())).rejects.toMatchObject({
      code: "RUN_IN_PROGRESS",
    });
  });
});

describe("review hardening (8.2)", () => {
  it("every session route refuses a stale session (sessionVersion bumped), not only import", async () => {
    await signIn();
    await settingsRepo.bumpSessionVersion();
    const run = await import("@/app/api/run/route");
    const runsId = await import("@/app/api/runs/[id]/route");
    const tokensRoute = await import("@/app/api/tokens/route");
    const tokenId = await import("@/app/api/tokens/[id]/route");
    const o = { origin: ORIGIN };
    const idCtx = { params: Promise.resolve({ id: "x" }) };
    const results = [
      await run.POST(req("/api/run", { headers: o })),
      await runsId.GET(
        req("/api/runs/x", { method: "GET" }),
        idCtx as Parameters<typeof runsId.GET>[1],
      ),
      await tokensRoute.GET(req("/api/tokens", { method: "GET" })),
      await tokensRoute.POST(req("/api/tokens", { body: { label: "x" }, headers: o })),
      await tokenId.DELETE(
        req("/api/tokens/x", { method: "DELETE", headers: o }),
        idCtx as Parameters<typeof tokenId.DELETE>[1],
      ),
    ];
    expect(results.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
    const { GET } = await import("@/app/api/health/route");
    expect(Object.keys(await (await GET()).json()).sort()).toEqual(["db", "ok"]); // no detail for a stale session
  });

  it("concurrent first requests in a new window never produce a 500 and count exactly", async () => {
    const { token } = await createToken("helper");
    const body = { matches: [match("c1")] };
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => ingest(req("/api/ingest", { headers: bearer(token), body }))),
    );
    expect(responses.map((r) => r.status).every((s) => s === 200 || s === 409)).toBe(true);
    const row = await getDb().rateLimit.findFirstOrThrow();
    expect(row.count).toBe(5);
  });

  it("the rate-limit window rolls over: last hour's counter does not block this hour", async () => {
    const { token, id } = await createToken("helper");
    const prev = new Date(Date.now() - 3_600_000);
    prev.setUTCMinutes(0, 0, 0);
    await getDb().rateLimit.create({
      data: {
        key: `ingest:${id}:${prev.toISOString().slice(0, 13)}`,
        count: 99,
        windowStart: prev,
      },
    });
    const res = await ingest(
      req("/api/ingest", { headers: bearer(token), body: { matches: [match("r1")] } }),
    );
    expect(res.status).toBe(200);
  });

  it("a rate-limited request does not run the pipeline (nothing stored, no run created)", async () => {
    const { token, id } = await createToken("helper");
    const hour = new Date();
    hour.setUTCMinutes(0, 0, 0);
    await getDb().rateLimit.create({
      data: {
        key: `ingest:${id}:${hour.toISOString().slice(0, 13)}`,
        count: 30,
        windowStart: hour,
      },
    });
    const res = await ingest(
      req("/api/ingest", { headers: bearer(token), body: { matches: [match("blocked")] } }),
    );
    expect(res.status).toBe(429);
    expect(await getDb().match.count()).toBe(0);
    expect(await getDb().screeningRun.count()).toBe(0);
  });

  it("401 happens before any write: no token → no rate-limit row, no run, no match", async () => {
    await ingest(req("/api/ingest", { body: { matches: [match("x")] } }));
    expect(await getDb().rateLimit.count()).toBe(0);
    expect(await getDb().screeningRun.count()).toBe(0);
  });

  it("OPTIONS with 'Origin: null' or no Origin is refused / headerless", async () => {
    const { OPTIONS } = await import("@/app/api/ingest/route");
    const nul = OPTIONS(req("/api/ingest", { method: "OPTIONS", headers: { origin: "null" } }));
    expect(nul.status).toBe(403);
    expect(nul.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("an unexpected pipeline failure leaves the run FAILED, never RUNNING, and the API answers 500", async () => {
    const { token } = await createToken("helper");
    const matches = await import("@/server/repositories/matches");
    const spy = vi.spyOn(matches, "storeBatch").mockRejectedValueOnce(new Error("boom"));
    const res = await ingest(
      req("/api/ingest", { headers: bearer(token), body: { matches: [match("f1")] } }),
    );
    spy.mockRestore();
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain("boom");
    expect(JSON.parse(text).error.code).toBe("INTERNAL");
    expect(await getDb().screeningRun.count({ where: { status: "RUNNING" } })).toBe(0);
    expect((await getDb().screeningRun.findFirstOrThrow()).status).toBe("FAILED");
  });
});
