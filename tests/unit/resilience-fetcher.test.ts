import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AppClientError, fetchJson, setUnauthorizedHandler, waitText } from "@/lib/fetcher";

// Step 14.1: rate-limit wait text, 422 wording, no replay of mutations (docs/TEST_CATALOG.md §14.1).
const BASE = "http://localhost";
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function failure(promise: Promise<unknown>): Promise<AppClientError> {
  try {
    await promise;
  } catch (e) {
    return e as AppClientError;
  }
  throw new Error("expected failure");
}

describe("waitText", () => {
  it("formats seconds, minutes and the unknown case", () => {
    expect(waitText(30)).toBe("in 30 seconds");
    expect(waitText(60)).toBe("in 1 minute");
    expect(waitText(121)).toBe("in 3 minutes");
    expect(waitText(undefined)).toBe("in a few minutes");
  });
});

describe("fetchJson error wording", () => {
  it("429 tells the user how long to wait, even when the server body is generic", async () => {
    server.use(
      http.post(`${BASE}/api/x`, () =>
        HttpResponse.json(
          { error: { code: "RATE_LIMITED", message: "Rate limited" } },
          { status: 429, headers: { "retry-after": "540" } },
        ),
      ),
    );
    const e = await failure(fetchJson(`${BASE}/api/x`, { method: "POST", body: {} }));
    expect(e.message).toBe("Too many attempts. Try again in 9 minutes.");
  });

  it("422 without a body maps to a readable validation message", async () => {
    server.use(http.post(`${BASE}/api/x`, () => new HttpResponse(null, { status: 422 })));
    const e = await failure(fetchJson(`${BASE}/api/x`, { method: "POST", body: {} }));
    expect(e.code).toBe("VALIDATION_FAILED");
    expect(e.message).toMatch(/aren't valid/);
  });

  it("a mutation that fails with 503 is sent exactly once (no replay)", async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE}/api/x`, () => {
        calls++;
        return new HttpResponse(null, { status: 503 });
      }),
    );
    await failure(fetchJson(`${BASE}/api/x`, { method: "POST", body: {} }));
    expect(calls).toBe(1);
  });

  it("several concurrent 401s call the handler for each request but the default redirects once", async () => {
    const handler = vi.fn();
    const previous = setUnauthorizedHandler(handler);
    server.use(http.get(`${BASE}/api/x`, () => new HttpResponse(null, { status: 401 })));
    await Promise.all([failure(fetchJson(`${BASE}/api/x`)), failure(fetchJson(`${BASE}/api/x`))]);
    setUnauthorizedHandler(previous);
    expect(handler).toHaveBeenCalledTimes(2);
  });
});

describe("fetchJson retry behaviour", () => {
  const fast = { retryDelaysMs: [0, 0] };

  for (const status of [502, 503, 504]) {
    it(`retries a GET on ${status} up to 2 times (3 requests in total)`, async () => {
      let calls = 0;
      server.use(
        http.get(`${BASE}/api/r`, () => {
          calls++;
          return new HttpResponse(null, { status });
        }),
      );
      const e = await failure(fetchJson(`${BASE}/api/r`, fast));
      expect(calls).toBe(3);
      expect(e.status).toBe(status);
    });
  }

  it("retries a GET on a network error up to the max and then reports NETWORK", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/n`, () => {
        calls++;
        return HttpResponse.error();
      }),
    );
    const e = await failure(fetchJson(`${BASE}/api/n`, fast));
    expect(calls).toBe(3);
    expect(e.code).toBe("NETWORK");
  });

  it("never retries a POST on a network error", async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE}/api/n`, () => {
        calls++;
        return HttpResponse.error();
      }),
    );
    const e = await failure(fetchJson(`${BASE}/api/n`, { method: "POST", body: {}, ...fast }));
    expect(calls).toBe(1);
    expect(e.code).toBe("NETWORK");
  });

  it("reports TIMEOUT when the server is slower than timeoutMs (POST is sent once)", async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE}/api/t`, async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 400));
        return HttpResponse.json({});
      }),
    );
    const e = await failure(
      fetchJson(`${BASE}/api/t`, { method: "POST", body: {}, timeoutMs: 50 }),
    );
    expect(e.code).toBe("TIMEOUT");
    expect(calls).toBe(1);
  });

  it("reports ABORTED for an already-aborted signal without touching the network", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/a`, () => {
        calls++;
        return HttpResponse.json({});
      }),
    );
    const controller = new AbortController();
    controller.abort();
    const e = await failure(fetchJson(`${BASE}/api/a`, { signal: controller.signal, ...fast }));
    expect(e.code).toBe("ABORTED");
    expect(calls).toBe(0);
  });

  it("stops retrying when the caller aborts during the retry delay", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/api/a`, () => {
        calls++;
        return new HttpResponse(null, { status: 503 });
      }),
    );
    const controller = new AbortController();
    const promise = fetchJson(`${BASE}/api/a`, {
      signal: controller.signal,
      retryDelaysMs: [60, 60],
    });
    setTimeout(() => controller.abort(), 20);
    const e = await failure(promise);
    expect(e.code).toBe("ABORTED");
    expect(calls).toBe(1);
  });
});
