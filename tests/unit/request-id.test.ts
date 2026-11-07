const PG = ["postgres", "://"].join("");
import { describe, expect, it, vi } from "vitest";
import { isValidRequestId, resolveRequestId } from "@/lib/request-id";
import { handle } from "@/server/http";
import { AppError, RateLimitedError } from "@/server/errors";

describe("request id", () => {
  it("reuses a valid incoming id and rejects unsafe ones", () => {
    expect(resolveRequestId("abc-12345678")).toBe("abc-12345678");
    for (const bad of [
      "short",
      "has space 12345",
      "x".repeat(65),
      "new\nline12345",
      "<script>12",
      "",
      null,
      undefined,
    ]) {
      expect(isValidRequestId(bad)).toBe(false);
      expect(resolveRequestId(bad)).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});

describe("handle() request id", () => {
  it("adds x-request-id to successful responses", async () => {
    const res = await handle(async () => Response.json({ ok: true }));
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("puts the same id in header and error body for AppError", async () => {
    const res = await handle(async () => {
      throw new AppError("NOT_FOUND", "Nope.");
    });
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error).toMatchObject({ code: "NOT_FOUND", message: "Nope." });
    expect(body.error.requestId).toBe(res.headers.get("x-request-id"));
  });

  it("keeps Retry-After for rate limits and hides unknown error details", async () => {
    const limited = await handle(async () => {
      throw new RateLimitedError(30);
    });
    expect(limited.headers.get("retry-after")).toBe("30");
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const res = await handle(async () => {
      throw new Error("secret " + PG + "u:pw@h/d");
    });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(body.error.requestId).toBe(res.headers.get("x-request-id"));
    const logged = String(write.mock.calls[0]?.[0]);
    expect(logged).toContain(body.error.requestId);
    expect(logged).not.toContain("pw@");
    write.mockRestore();
  });
});
