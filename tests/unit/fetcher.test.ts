import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AppClientError, fetchJson, setUnauthorizedHandler } from "@/lib/fetcher";

const BASE = "http://localhost";
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator, "onLine");
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

const fast = { retryDelaysMs: [0, 0] };

async function failure(promise: Promise<unknown>): Promise<AppClientError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(AppClientError);
    return e as AppClientError;
  }
  throw new Error("expected the request to fail");
}

describe("fetchJson", () => {
  it("returns parsed JSON on success", async () => {
    server.use(http.get(`${BASE}/api/x`, () => HttpResponse.json({ ok: true })));
    expect(await fetchJson<{ ok: boolean }>(`${BASE}/api/x`)).toEqual({ ok: true });
  });

  it("sends JSON bodies with a content-type header", async () => {
    let seen = "";
    server.use(
      http.post(`${BASE}/api/x`, async ({ request }) => {
        seen = `${request.headers.get("content-type")}|${await request.text()}`;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    expect(await fetchJson(`${BASE}/api/x`, { method: "POST", body: { a: 1 } })).toBeUndefined();
    expect(seen).toBe('application/json|{"a":1}');
  });

  it("retries a GET on 503 twice then succeeds", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/x`, () =>
        ++calls < 3 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({ ok: 1 }),
      ),
    );
    expect(await fetchJson(`${BASE}/api/x`, fast)).toEqual({ ok: 1 });
    expect(calls).toBe(3);
  });

  it("gives up after the retry limit and reports the status", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/x`, () => {
        calls++;
        return new HttpResponse(null, { status: 503 });
      }),
    );
    const error = await failure(fetchJson(`${BASE}/api/x`, fast));
    expect(calls).toBe(3); // 1 try + 2 retries, not more
    expect(error.status).toBe(503);
  });

  it("does not retry a POST", async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE}/api/x`, () => {
        calls++;
        return new HttpResponse(null, { status: 503 });
      }),
    );
    await failure(fetchJson(`${BASE}/api/x`, { method: "POST", body: {}, ...fast }));
    expect(calls).toBe(1);
  });

  it("times out and reports TIMEOUT", async () => {
    server.use(
      http.get(`${BASE}/api/x`, async () => {
        await delay(400);
        return HttpResponse.json({});
      }),
    );
    const error = await failure(fetchJson(`${BASE}/api/x`, { timeoutMs: 50, retries: 0 }));
    expect(error.code).toBe("TIMEOUT");
  });

  it("throws OFFLINE immediately without touching the network", async () => {
    // Node\u0027s navigator has no `onLine`; define it for this test and remove it afterwards.
    Object.defineProperty(globalThis.navigator, "onLine", { value: false, configurable: true });
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/x`, () => {
        calls++;
        return HttpResponse.json({});
      }),
    );
    const error = await failure(fetchJson(`${BASE}/api/x`));
    expect(error.code).toBe("OFFLINE");
    expect(calls).toBe(0);
  });

  it("maps the standard error body, including field errors", async () => {
    server.use(
      http.post(`${BASE}/api/x`, () =>
        HttpResponse.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Check the highlighted fields.",
              fieldErrors: { low: ["Must be below high."] },
            },
          },
          { status: 422 },
        ),
      ),
    );
    const error = await failure(fetchJson(`${BASE}/api/x`, { method: "POST", body: {} }));
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.message).toBe("Check the highlighted fields.");
    expect(error.fieldErrors).toEqual({ low: ["Must be below high."] });
  });

  it("normalises the server's string field errors to string[] (real API shape)", async () => {
    server.use(
      http.put(`${BASE}/api/x`, () =>
        HttpResponse.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Some settings are not valid.",
              fieldErrors: { lowThreshold: "The lower threshold must be below the upper one." },
            },
          },
          { status: 422 },
        ),
      ),
    );
    const error = await failure(fetchJson(`${BASE}/api/x`, { method: "PUT", body: {} }));
    expect(error.fieldErrors?.lowThreshold?.[0]).toBe(
      "The lower threshold must be below the upper one.",
    );
  });

  it("calls the unauthorized handler on 401", async () => {
    const handler = vi.fn();
    const previous = setUnauthorizedHandler(handler);
    server.use(http.get(`${BASE}/api/x`, () => new HttpResponse(null, { status: 401 })));
    const error = await failure(fetchJson(`${BASE}/api/x`));
    setUnauthorizedHandler(previous);
    expect(error.code).toBe("UNAUTHORIZED");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("maps 429 with Retry-After and 413 to friendly codes", async () => {
    server.use(
      http.get(
        `${BASE}/api/limited`,
        () => new HttpResponse(null, { status: 429, headers: { "retry-after": "120" } }),
      ),
      http.post(`${BASE}/api/big`, () => new HttpResponse(null, { status: 413 })),
    );
    const limited = await failure(fetchJson(`${BASE}/api/limited`));
    expect(limited.code).toBe("RATE_LIMITED");
    expect(limited.retryAfterSeconds).toBe(120);
    const big = await failure(fetchJson(`${BASE}/api/big`, { method: "POST", body: {} }));
    expect(big.code).toBe("PAYLOAD_TOO_LARGE");
    expect(big.message).toContain("max 1 MB");
  });

  it("never exposes raw server text for non-JSON errors", async () => {
    server.use(
      http.get(
        `${BASE}/api/x`,
        () => new HttpResponse("Error: db password is hunter2\n at line 3", { status: 500 }),
      ),
    );
    const error = await failure(fetchJson(`${BASE}/api/x`, { retries: 0 }));
    expect(error.message).not.toContain("hunter2");
    expect(error.code).toBe("INTERNAL");
  });

  it("reports ABORTED when the caller cancels", async () => {
    server.use(
      http.get(`${BASE}/api/x`, async () => {
        await delay(300);
        return HttpResponse.json({});
      }),
    );
    const controller = new AbortController();
    const promise = fetchJson(`${BASE}/api/x`, { signal: controller.signal, retries: 0 });
    controller.abort();
    expect((await failure(promise)).code).toBe("ABORTED");
  });
});
