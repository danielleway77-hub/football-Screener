import { afterEach, describe, expect, it, vi } from "vitest";
import { isPooledUrl, poolConfig, POOL } from "@/lib/db";
import { isTransientDbError, readQuery } from "@/lib/db-retry";

afterEach(() => vi.restoreAllMocks());

describe("pool settings", () => {
  it("sets sane limits", () => {
    expect(POOL.max).toBeGreaterThan(0);
    expect(POOL.max).toBeLessThanOrEqual(10);
    expect(POOL.idleTimeoutMillis).toBeLessThanOrEqual(30_000);
    expect(POOL.connectionTimeoutMillis).toBeGreaterThan(0);
    expect(POOL.query_timeout).toBeGreaterThan(POOL.statement_timeout);
  });
  it("skips statement_timeout for pooler URLs only", () => {
    expect(isPooledUrl("postgresql://u:p@aws-0.pooler.supabase.com:6543/postgres")).toBe(true);
    expect(isPooledUrl("postgresql://u:p@h:6543/postgres")).toBe(true);
    expect(isPooledUrl("postgresql://u:p@localhost:5432/postgres")).toBe(false);
    expect(isPooledUrl("not a url")).toBe(false);
    expect(poolConfig("postgresql://u:p@h:6543/d")).not.toHaveProperty("statement_timeout");
    expect(poolConfig("postgresql://u:p@localhost:5432/d")).toHaveProperty(
      "statement_timeout",
      15_000,
    );
  });
});

describe("transient error detection", () => {
  it("recognises connection-level failures", () => {
    expect(isTransientDbError(Object.assign(new Error("x"), { code: "ECONNRESET" }))).toBe(true);
    expect(isTransientDbError(Object.assign(new Error("x"), { code: "P1017" }))).toBe(true);
    expect(isTransientDbError(new Error("Connection terminated unexpectedly"))).toBe(true);
    expect(isTransientDbError({ cause: { code: "57P01" } })).toBe(true);
  });
  it("does not treat logic errors as transient", () => {
    expect(isTransientDbError(Object.assign(new Error("dup"), { code: "P2002" }))).toBe(false);
    expect(isTransientDbError(Object.assign(new Error("x"), { code: "23505" }))).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
    expect(isTransientDbError("string")).toBe(false);
  });
});

describe("readQuery", () => {
  const quiet = () => vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  it("returns the first success without retrying", async () => {
    const run = vi.fn().mockResolvedValue(1);
    expect(await readQuery(run)).toBe(1);
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("retries exactly once on a transient error", async () => {
    quiet();
    const run = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("reset"), { code: "ECONNRESET" }))
      .mockResolvedValueOnce("ok");
    expect(await readQuery(run, { delayMs: 0 })).toBe("ok");
    expect(run).toHaveBeenCalledTimes(2);
  });
  it("gives up after the second transient failure", async () => {
    quiet();
    const run = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("reset"), { code: "ECONNRESET" }));
    await expect(readQuery(run, { delayMs: 0 })).rejects.toThrow("reset");
    expect(run).toHaveBeenCalledTimes(2);
  });
  it("never retries non-transient errors", async () => {
    const run = vi.fn().mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    await expect(readQuery(run)).rejects.toThrow("dup");
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("repository policy", () => {
  it("write functions never use readQuery", async () => {
    const fs = await import("node:fs");
    const writes = [
      "upsertMany",
      "deleteOlderThan",
      "storeBatch",
      "applyScreening",
      "createRunning",
      "finish",
      "record",
      "purge",
      "increment",
      "create",
      "revoke",
      "touch",
    ];
    for (const file of fs.readdirSync("src/server/repositories")) {
      const text = fs.readFileSync(`src/server/repositories/${file}`, "utf8");
      for (const name of writes) {
        const start = text.indexOf(`export async function ${name}(`);
        const end = start < 0 ? -1 : text.indexOf("\n}\n", start);
        const m = start < 0 ? null : [text.slice(start, end)];
        if (m) expect(m[0], `${file}:${name}`).not.toContain("readQuery");
      }
    }
  });
});
