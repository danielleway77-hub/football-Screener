/* eslint-disable @typescript-eslint/no-explicit-any -- redact() returns unknown; tests probe its shape */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger, redact, redactString, withRequestId, REDACTED } from "@/lib/logger";

let out: string[];
let err: string[];
beforeEach(() => {
  out = [];
  err = [];
  vi.spyOn(process.stdout, "write").mockImplementation((c) => (out.push(String(c)), true));
  vi.spyOn(process.stderr, "write").mockImplementation((c) => (err.push(String(c)), true));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("logger", () => {
  it("writes one JSON line with time, level, msg and context", () => {
    logger.info("hello", { runId: "r1" });
    const line = JSON.parse(out[0]!);
    expect(line).toMatchObject({ level: "info", msg: "hello", runId: "r1" });
    expect(new Date(line.time).getTime()).not.toBeNaN();
    expect(out[0]!.endsWith("\n")).toBe(true);
  });

  it("sends warn and error to stderr", () => {
    logger.warn("w");
    logger.error("e");
    expect(out).toHaveLength(0);
    expect(err.map((l) => JSON.parse(l).level)).toEqual(["warn", "error"]);
  });

  it("honours LOG_LEVEL and defaults to info", () => {
    logger.debug("hidden");
    expect(out).toHaveLength(0);
    vi.stubEnv("LOG_LEVEL", "debug");
    logger.debug("shown");
    expect(out).toHaveLength(1);
    vi.stubEnv("LOG_LEVEL", "error");
    logger.warn("hidden");
    expect(err).toHaveLength(0);
    vi.stubEnv("LOG_LEVEL", "nonsense");
    logger.info("fallback-info");
    expect(out).toHaveLength(2);
  });

  it("attaches the request id from async context", async () => {
    await withRequestId("req-12345678", async () => {
      await Promise.resolve();
      logger.info("inside");
    });
    logger.info("outside");
    expect(JSON.parse(out[0]!).requestId).toBe("req-12345678");
    expect(JSON.parse(out[1]!).requestId).toBeUndefined();
  });
});

describe("redaction", () => {
  it("redacts sensitive keys at any depth", () => {
    const r = redact({
      password: "p",
      nested: { Authorization: "Bearer abc", cookie: "a=b", apiKey: "k", keep: "ok" },
      list: [{ token: "t" }],
    }) as Record<string, any>;
    expect(r.password).toBe(REDACTED);
    expect(r.nested.Authorization).toBe(REDACTED);
    expect(r.nested.cookie).toBe(REDACTED);
    expect(r.nested.apiKey).toBe(REDACTED);
    expect(r.nested.keep).toBe("ok");
    expect(r.list[0].token).toBe(REDACTED);
  });

  it("scrubs secrets inside free text", () => {
    const text = redactString(
      "connect postgresql://user:hunter2@db.host:5432/app failed; Bearer abc.def-ghi; DATABASE_URL=postgres://x:y@h/d password=hunter2",
    );
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("abc.def-ghi");
    expect(text).not.toContain("x:y@");
    expect(redactString("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig")).toBe(REDACTED);
  });

  it("keeps only name and redacted message of errors and survives cycles", () => {
    const e = new Error("bad postgres://u:pw@h/db");
    const circular: Record<string, unknown> = { e };
    circular.self = circular;
    const r = redact(circular) as Record<string, any>;
    expect(r.e).toEqual({ name: "Error", message: `bad postgres://${REDACTED}@h/db` });
    expect(r.self).toBe("[Circular]");
    expect(JSON.stringify(r)).not.toContain("stack");
  });

  it("redacts when logging end to end", () => {
    logger.error("db down postgres://u:secretpw@h/d", {
      password: "x",
      err: new Error("token=abc"),
    });
    const raw = err[0]!;
    expect(raw).not.toContain("secretpw");
    expect(raw).not.toContain("abc");
    expect(raw).toContain(REDACTED);
  });
});
