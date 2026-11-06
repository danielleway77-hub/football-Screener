import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { signSessionToken, verifySessionToken } from "@/server/auth/jwt";
import { verifyPassword } from "@/server/auth/password";
import { hashPassword } from "@/server/auth/password";
import * as runs from "@/server/repositories/runs";
import * as settingsRepo from "@/server/repositories/settings";
import { processBatch } from "@/server/services/run-service";
import { createToken, listTokens, revokeToken } from "@/server/services/token-service";
import { setupTestDb } from "./helpers";

const SECRET = "s".repeat(40);
const ORIGIN = "http://localhost:3000";
const OLD_PASSWORD = "old-password-123";
let cookieValue: string | undefined;
const cookieWrites: { name: string; value: string }[] = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (cookieValue ? { value: cookieValue } : undefined),
    set: (name: string, value: string) => {
      cookieWrites.push({ name, value });
    },
  }),
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
  vi.stubEnv("NEXT_PUBLIC_APP_URL", ORIGIN);
  vi.stubEnv("APP_PASSWORD_HASH", await hashPassword(OLD_PASSWORD));
  cookieValue = undefined;
  cookieWrites.length = 0;
  await settingsRepo.ensureSettings();
});

async function signIn(version?: number) {
  const s = await settingsRepo.getSettings();
  cookieValue = await signSessionToken(version ?? s.sessionVersion, SECRET);
  return cookieValue;
}

function req(
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
) {
  const method = init.method ?? "POST";
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(method === "GET" ? {} : { origin: ORIGIN }),
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const match = (id: string, home: number, away: number) => ({
  provider: "manual_import",
  providerMatchId: id,
  kickoffAt: "2026-11-04T15:00:00Z",
  home: { name: `H${id}`, formPct: home },
  away: { name: `A${id}`, formPct: away },
  formScope: "league",
});

async function seedStored() {
  const settings = await settingsRepo.getSettings();
  // At the default 75/35: 72 vs 38 does NOT qualify; at 70/40 it does. 80 vs 7 qualifies at both.
  await processBatch({
    trigger: "IMPORT",
    provider: "manual_import",
    payload: { matches: [match("a", 72, 38), match("b", 80, 7), match("c", 50, 50)] },
    settings,
  });
}

const qualifiesOf = async () =>
  Object.fromEntries((await getDb().match.findMany()).map((m) => [m.providerMatchId, m.qualifies]));

describe("/api/settings", () => {
  it("GET and PUT need a session; PUT needs the same origin", async () => {
    const { GET, PUT } = await import("@/app/api/settings/route");
    expect((await GET(req("/api/settings", { method: "GET" }))).status).toBe(401);
    expect(
      (await PUT(req("/api/settings", { method: "PUT", body: { windowDays: 1 } }))).status,
    ).toBe(401);
    await signIn();
    const cross = await PUT(
      req("/api/settings", {
        method: "PUT",
        headers: { origin: "https://evil.example" },
        body: { windowDays: 1 },
      }),
    );
    expect(cross.status).toBe(403);
    expect((await settingsRepo.getSettings()).windowDays).toBe(2);
  });

  it("GET never exposes the session version", async () => {
    await signIn();
    const { GET } = await import("@/app/api/settings/route");
    const body = await (await GET(req("/api/settings", { method: "GET" }))).json();
    expect(body.settings).toMatchObject({ highThreshold: 75, lowThreshold: 35, windowDays: 2 });
    expect(JSON.stringify(body)).not.toContain("sessionVersion");
  });

  it("PUT saves, and changed thresholds re-screen the stored matches at 70/40", async () => {
    await seedStored();
    expect(await qualifiesOf()).toEqual({ a: false, b: true, c: false });
    await signIn();
    const { PUT } = await import("@/app/api/settings/route");
    const res = await PUT(
      req("/api/settings", { method: "PUT", body: { highThreshold: 70, lowThreshold: 40 } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      thresholdsChanged: true,
      rescreen: { changed: 1, qualifying: 2 },
      rescreenSkipped: null,
    });
    expect(await qualifiesOf()).toEqual({ a: true, b: true, c: false });
    expect(await settingsRepo.getSettings()).toMatchObject({
      highThreshold: 70,
      lowThreshold: 40,
    });
  });

  it("saving something other than thresholds does not re-screen", async () => {
    await seedStored();
    await signIn();
    const { PUT } = await import("@/app/api/settings/route");
    const body = await (
      await PUT(req("/api/settings", { method: "PUT", body: { windowDays: 1, staleAfterHrs: 12 } }))
    ).json();
    expect(body).toMatchObject({ thresholdsChanged: false, windowChanged: true, rescreen: null });
    expect(await getDb().match.count()).toBe(3); // windowDays change never deletes data
  });

  it("an update in progress keeps the settings saved but skips the re-screen with a reason", async () => {
    await seedStored();
    await runs.createRunning({
      trigger: "MANUAL",
      provider: "manual_import",
      startedAt: new Date(),
    });
    await signIn();
    const { PUT } = await import("@/app/api/settings/route");
    const res = await PUT(
      req("/api/settings", { method: "PUT", body: { highThreshold: 70, lowThreshold: 40 } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rescreen).toBeNull();
    expect(body.rescreenSkipped).toMatch(/update is running/i);
    expect(await settingsRepo.getSettings()).toMatchObject({ highThreshold: 70 });
    expect(await qualifiesOf()).toEqual({ a: false, b: true, c: false });
  });

  it("invalid values come back as 422 with field errors and change nothing", async () => {
    await signIn();
    const { PUT } = await import("@/app/api/settings/route");
    for (const [bad, field] of [
      [{ lowThreshold: 60, highThreshold: 60 }, "lowThreshold"],
      [{ windowDays: 3 }, "windowDays"],
      [{ timezone: "Mars/Olympus" }, "timezone"],
      [{ staleAfterHrs: 0 }, "staleAfterHrs"],
      [{ sessionVersion: 5 }, "settings"],
    ] as const) {
      const res = await PUT(req("/api/settings", { method: "PUT", body: bad }));
      expect(res.status, JSON.stringify(bad)).toBe(422);
      const err = (await res.json()).error;
      expect(err.code).toBe("VALIDATION_FAILED");
      expect(Object.keys(err.fieldErrors ?? {}), JSON.stringify(bad)).toContain(field);
    }
    expect(await settingsRepo.getSettings()).toMatchObject({ windowDays: 2, staleAfterHrs: 26 });
  });

  it("POST /api/settings/rescreen applies the saved thresholds and reports the counts", async () => {
    await seedStored();
    await settingsRepo.updateSettings({ highThreshold: 70, lowThreshold: 40 });
    const { POST } = await import("@/app/api/settings/rescreen/route");
    expect((await POST(req("/api/settings/rescreen"))).status).toBe(401);
    await signIn();
    const res = await POST(req("/api/settings/rescreen"));
    expect(await res.json()).toMatchObject({ changed: 1, qualifying: 2, total: 3 });
    // Idempotent: nothing left to change.
    expect(await (await POST(req("/api/settings/rescreen"))).json()).toMatchObject({ changed: 0 });
  });
});

describe("ingest tokens", () => {
  it("token create shows the plaintext once; the list never contains it", async () => {
    await signIn();
    const { POST, GET } = await import("@/app/api/tokens/route");
    const created = await POST(req("/api/tokens", { body: { label: "Home laptop" } }));
    expect(created.status).toBe(201);
    const { token, id } = await created.json();
    expect(token).toMatch(/^scr_/);
    const listText = await (await GET(req("/api/tokens", { method: "GET" }))).text();
    expect(listText).not.toContain(token);
    expect(listText).not.toContain("tokenHash");
    expect(JSON.parse(listText).tokens).toEqual([
      expect.objectContaining({ id, label: "Home laptop", revokedAt: null }),
    ]);
  });

  it("a revoked token fails /api/ingest with 401", async () => {
    const { token, id } = await createToken("helper");
    const { POST: ingest } = await import("@/app/api/ingest/route");
    const send = () =>
      ingest(
        req("/api/ingest", {
          headers: { authorization: `Bearer ${token}` },
          body: { matches: [match("t1", 80, 7)] },
        }),
      );
    expect((await send()).status).toBe(200);
    await signIn();
    const { DELETE } = await import("@/app/api/tokens/[id]/route");
    const ctx = { params: Promise.resolve({ id }) } as Parameters<typeof DELETE>[1];
    expect((await DELETE(req(`/api/tokens/${id}`, { method: "DELETE" }), ctx)).status).toBe(204);
    expect((await send()).status).toBe(401);
    // Revoking again is harmless.
    expect((await DELETE(req(`/api/tokens/${id}`, { method: "DELETE" }), ctx)).status).toBe(204);
  });

  it("allows at most 5 active tokens; revoking one frees a slot", async () => {
    const made = [];
    for (let i = 1; i <= 5; i++) made.push(await createToken(`t${i}`));
    await expect(createToken("t6")).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      fieldErrors: { label: expect.stringContaining("5 active") },
    });
    await revokeToken(made[0]!.id);
    await expect(createToken("t6")).resolves.toMatchObject({ label: "t6" });
    expect((await listTokens()).length).toBe(6); // revoked rows stay listed
  });
});

describe("POST /api/settings/password", () => {
  const post = async (body: unknown) =>
    (await import("@/app/api/settings/password/route")).POST(
      req("/api/settings/password", { body }),
    );

  it("rejects a wrong current password, a short one and an unchanged one", async () => {
    await signIn();
    const wrong = await post({
      currentPassword: "nope-nope-nope",
      newPassword: "brand-new-pass-1",
    });
    expect(wrong.status).toBe(422);
    expect((await wrong.json()).error.fieldErrors).toHaveProperty("currentPassword");
    const short = await post({ currentPassword: OLD_PASSWORD, newPassword: "short" });
    expect((await short.json()).error.fieldErrors).toHaveProperty("newPassword");
    const same = await post({ currentPassword: OLD_PASSWORD, newPassword: OLD_PASSWORD });
    expect((await same.json()).error.fieldErrors).toHaveProperty("newPassword");
    expect(await getDb().credential.count()).toBe(0);
    expect((await settingsRepo.getSettings()).sessionVersion).toBe(1);
  });

  it("needs a session and the same origin", async () => {
    const body = { currentPassword: OLD_PASSWORD, newPassword: "brand-new-pass-1" };
    expect((await post(body)).status).toBe(401);
    await signIn();
    const { POST } = await import("@/app/api/settings/password/route");
    const cross = await POST(
      req("/api/settings/password", { headers: { origin: "https://evil.example" }, body }),
    );
    expect(cross.status).toBe(403);
  });

  it("success updates the Credential, bumps sessionVersion, logs other sessions out and keeps the current one", async () => {
    const other = await signIn(); // "second browser"
    const before = (await settingsRepo.getSettings()).sessionVersion;
    const res = await post({ currentPassword: OLD_PASSWORD, newPassword: "brand-new-pass-1" });
    expect(res.status).toBe(204);

    // Credential row now holds the new hash and overrides APP_PASSWORD_HASH.
    expect(await getDb().credential.count()).toBe(1);
    expect(await verifyPassword("brand-new-pass-1")).toBe(true);
    expect(await verifyPassword(OLD_PASSWORD)).toBe(false);
    expect(JSON.stringify(await getDb().credential.findFirst())).not.toContain("brand-new-pass-1");

    // The session version moved on, so the old cookie is invalid ...
    const after = (await settingsRepo.getSettings()).sessionVersion;
    expect(after).toBe(before + 1);
    cookieValue = other;
    const { hasValidSession } = await import("@/server/auth/guard");
    expect(await hasValidSession()).toBe(false);

    // ... while the response re-issued a cookie for THIS device with the new version.
    expect(cookieWrites).toHaveLength(1);
    const fresh = cookieWrites[0]!.value;
    expect(await verifySessionToken(fresh, SECRET)).toEqual({ v: after });
    cookieValue = fresh;
    expect(await hasValidSession()).toBe(true);
  });

  it("repeated wrong current passwords are rate limited", async () => {
    await signIn();
    for (let i = 0; i < 5; i++) {
      expect(
        (await post({ currentPassword: "wrong-wrong-1", newPassword: "brand-new-pass-1" })).status,
      ).toBe(422);
    }
    const blocked = await post({ currentPassword: OLD_PASSWORD, newPassword: "brand-new-pass-1" });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect(await getDb().credential.count()).toBe(0);
  });
});
