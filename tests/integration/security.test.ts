import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { getDb } from "@/lib/db";
import { signSessionToken } from "@/server/auth/jwt";
import * as settingsRepo from "@/server/repositories/settings";
import { createToken } from "@/server/services/token-service";
import { setupTestDb } from "./helpers";

// Step 16.1 security sweep (docs/TESTING_STANDARDS section 5b) over EVERY session-protected API handler.
// The route inventory (tests/unit/route-inventory.test.ts) guarantees no handler is missing from the scan;
// the cases below prove the behaviour of each one.
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
  vi.stubEnv("NEXT_PUBLIC_APP_URL", ORIGIN);
  vi.stubEnv("CRON_SECRET", "c".repeat(40));
  cookieValue = undefined;
  await settingsRepo.ensureSettings();
});

type Endpoint = {
  name: string;
  method: string;
  path: string;
  mutating: boolean;
  body?: unknown;
  call: (r: Request) => Promise<Response>;
};

const ID = "00000000-0000-4000-8000-000000000000";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctxId = (): any => ({ params: Promise.resolve({ id: ID }) });

const ENDPOINTS: Endpoint[] = [
  {
    name: "import",
    method: "POST",
    path: "/api/import",
    mutating: true,
    body: { matches: [] },
    call: async (r) => (await import("@/app/api/import/route")).POST(r),
  },
  {
    name: "run",
    method: "POST",
    path: "/api/run",
    mutating: true,
    body: {},
    call: async (r) => (await import("@/app/api/run/route")).POST(r),
  },
  {
    name: "runs/[id]",
    method: "GET",
    path: `/api/runs/${ID}`,
    mutating: false,
    call: async (r) => (await import("@/app/api/runs/[id]/route")).GET(r, ctxId()),
  },
  {
    name: "settings GET",
    method: "GET",
    path: "/api/settings",
    mutating: false,
    call: async (r) => (await import("@/app/api/settings/route")).GET(r),
  },
  {
    name: "settings PUT",
    method: "PUT",
    path: "/api/settings",
    mutating: true,
    body: {},
    call: async (r) => (await import("@/app/api/settings/route")).PUT(r),
  },
  {
    name: "settings/password",
    method: "POST",
    path: "/api/settings/password",
    mutating: true,
    body: {},
    call: async (r) => (await import("@/app/api/settings/password/route")).POST(r),
  },
  {
    name: "settings/rescreen",
    method: "POST",
    path: "/api/settings/rescreen",
    mutating: true,
    body: {},
    call: async (r) => (await import("@/app/api/settings/rescreen/route")).POST(r),
  },
  {
    name: "tokens GET",
    method: "GET",
    path: "/api/tokens",
    mutating: false,
    call: async (r) => (await import("@/app/api/tokens/route")).GET(r),
  },
  {
    name: "tokens POST",
    method: "POST",
    path: "/api/tokens",
    mutating: true,
    body: { label: "x" },
    call: async (r) => (await import("@/app/api/tokens/route")).POST(r),
  },
  {
    name: "tokens/[id]",
    method: "DELETE",
    path: `/api/tokens/${ID}`,
    mutating: true,
    call: async (r) => (await import("@/app/api/tokens/[id]/route")).DELETE(r, ctxId()),
  },
];

function build(e: Endpoint, headers: Record<string, string> = {}, body: unknown = e.body) {
  const hasBody = e.method !== "GET" && e.method !== "DELETE";
  return new Request(`${ORIGIN}${e.path}`, {
    method: e.method,
    headers: { "content-type": "application/json", ...headers },
    body: hasBody ? (typeof body === "string" ? body : JSON.stringify(body ?? {})) : undefined,
  });
}
const validCookie = async () =>
  signSessionToken((await settingsRepo.getSettings()).sessionVersion, SECRET);
const sameOrigin = { origin: ORIGIN };

async function expectUnauthorized(e: Endpoint, headers: Record<string, string> = sameOrigin) {
  const res = await e.call(build(e, headers));
  expect(res.status, e.name).toBe(401);
  const text = await res.text();
  expect(JSON.parse(text).error.code).toBe("UNAUTHORIZED");
  expect(text).not.toMatch(/stack|prisma|SELECT|node_modules/i);
  expect(res.headers.get("cache-control")).toBe("no-store");
}

describe("every session API without credentials", () => {
  it.each(ENDPOINTS)("$method $path -> 401, generic body, no-store", async (e) => {
    await expectUnauthorized(e);
    await expectUnauthorized(e, {}); // and without any Origin
  });
});

describe("tampered, expired, wrong-secret and revoked sessions", () => {
  it.each(ENDPOINTS)("$method $path rejects forged cookies", async (e) => {
    const good = await validCookie();
    const [h, p, s] = good.split(".") as [string, string, string];
    const flipped = s.slice(0, -2) + (s.endsWith("AA") ? "BB" : "AA");
    const forgedPayload = Buffer.from(JSON.stringify({ v: 999, exp: 9999999999 })).toString(
      "base64url",
    );
    const noneAlg = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const key = new TextEncoder().encode(SECRET);
    const past = Math.floor(Date.now() / 1000) - 3600;
    const expired = await new SignJWT({ v: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(past - 100)
      .setExpirationTime(past)
      .sign(key);
    const wrongKey = await signSessionToken(1, "x".repeat(40));
    const stringVersion = await new SignJWT({ v: "1" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key);
    for (const bad of [
      `${h}.${p}.${flipped}`, // signature tampered
      `${h}.${forgedPayload}.${s}`, // payload swapped, signature kept
      `${noneAlg}.${p}.`, // alg=none
      expired,
      wrongKey,
      stringVersion,
      "garbage",
      "",
    ]) {
      cookieValue = bad;
      await expectUnauthorized(e);
    }
  });

  it.each(ENDPOINTS)("$method $path rejects a session revoked by log-out-everywhere", async (e) => {
    cookieValue = await validCookie();
    await getDb().setting.updateMany({ data: { sessionVersion: { increment: 1 } } });
    await expectUnauthorized(e);
  });

  it("sanity: the same cookie is accepted before revocation (the tests above are not vacuous)", async () => {
    cookieValue = await validCookie();
    const e = ENDPOINTS.find((x) => x.name === "settings GET")!;
    expect((await e.call(build(e))).status).toBe(200);
  });
});

describe("Origin check on mutating session routes", () => {
  const mutating = ENDPOINTS.filter((e) => e.mutating);
  it.each(mutating)("$method $path refuses wrong, null and missing Origin with 403", async (e) => {
    cookieValue = await validCookie();
    const cases: Record<string, string>[] = [
      { origin: "https://evil.example" },
      { origin: "http://localhost:3000.evil.example" },
      { origin: "null" },
      {},
    ];
    for (const headers of cases) {
      const res = await e.call(build(e, headers));
      expect(res.status, JSON.stringify(headers)).toBe(403);
      expect((await res.json()).error.code).toBe("FORBIDDEN");
    }
  });
  it("read-only routes ignore Origin (no CSRF surface) but still need the session", async () => {
    cookieValue = await validCookie();
    const e = ENDPOINTS.find((x) => x.name === "tokens GET")!;
    expect((await e.call(build(e, { origin: "https://evil.example" }))).status).toBe(200);
  });
});

describe("oversized bodies", () => {
  const limits: [string, number][] = [
    ["import", 1024 * 1024],
    ["settings PUT", 4096],
    ["settings/password", 2048],
    ["tokens POST", 2048],
  ];
  it.each(limits)("%s answers 413 above %i bytes (declared and streamed)", async (name, max) => {
    cookieValue = await validCookie();
    const e = ENDPOINTS.find((x) => x.name === name)!;
    const big = "a".repeat(max + 10);
    const declared = build(e, { ...sameOrigin, "content-length": String(max + 10) }, `"${big}"`);
    expect((await e.call(declared)).status).toBe(413);
    // Chunked (no content-length): counted while streaming.
    const chunked = new Request(`${ORIGIN}${e.path}`, {
      method: e.method,
      headers: { "content-type": "application/json", ...sameOrigin },
      body: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(`"${big}"`));
          c.close();
        },
      }),
      duplex: "half",
    } as RequestInit);
    expect((await e.call(chunked)).status).toBe(413);
  });

  it("ingest (bearer) and login also cap the body", async () => {
    const { token } = await createToken("big");
    const ingest = (await import("@/app/api/ingest/route")).POST;
    const res = await ingest(
      new Request(`${ORIGIN}/api/ingest`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ pad: "a".repeat(1024 * 1024 + 10) }),
      }),
    );
    expect(res.status).toBe(413);
    const login = (await import("@/app/api/auth/login/route")).POST;
    const l = await login(
      new Request(`${ORIGIN}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json", ...sameOrigin },
        body: JSON.stringify({ password: "a".repeat(5000) }),
      }),
    );
    expect(l.status).toBe(413);
  });
});

describe("cron endpoint", () => {
  it("rejects missing, wrong and prefix-only secrets with 401", async () => {
    const { GET } = await import("@/app/api/cron/daily/route");
    for (const authorization of [
      undefined,
      "Bearer wrong",
      "Bearer ",
      "c".repeat(40),
      `Bearer ${"c".repeat(39)}`,
    ]) {
      const res = await GET(
        new Request(`${ORIGIN}/api/cron/daily`, {
          headers: authorization ? { authorization } : {},
        }),
      );
      expect(res.status, String(authorization)).toBe(401);
    }
  });
});

describe("health does not leak", () => {
  it("anonymous health exposes only ok and db", async () => {
    const { GET } = await import("@/app/api/health/route");
    const body = await (await GET()).json();
    expect(Object.keys(body).sort()).toEqual(["db", "ok"]);
  });
});
