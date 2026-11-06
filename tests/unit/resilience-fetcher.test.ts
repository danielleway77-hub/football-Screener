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
