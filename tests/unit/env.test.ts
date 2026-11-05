import { afterEach, describe, expect, it, vi } from "vitest";
import { EnvValidationError, parseServerEnv } from "@/lib/env-schema";

const HASH = "$2b$12$" + "a".repeat(53);

const valid = {
  DATABASE_URL: "postgresql://user:pass@ep-test-pooler.example.neon.tech/neondb?sslmode=require",
  DIRECT_URL: "postgresql://user:pass@ep-test.example.neon.tech/neondb?sslmode=require",
  SESSION_SECRET: "s".repeat(32),
  CRON_SECRET: "c".repeat(32),
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  INGEST_ALLOWED_ORIGINS: "https://predigoal.com",
};

function messageFor(source: Record<string, string | undefined>): string {
  try {
    parseServerEnv(source);
  } catch (error) {
    expect(error).toBeInstanceOf(EnvValidationError);
    return (error as Error).message;
  }
  throw new Error("expected parseServerEnv to throw");
}

describe("server env validation", () => {
  it("accepts a complete valid environment and parses the origin list", () => {
    const env = parseServerEnv({
      ...valid,
      INGEST_ALLOWED_ORIGINS: "https://predigoal.com, http://localhost:3000",
    });
    expect(env.INGEST_ALLOWED_ORIGINS).toEqual(["https://predigoal.com", "http://localhost:3000"]);
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.NODE_ENV).toBe("development");
  });

  it("throws a readable error listing every missing variable", () => {
    const message = messageFor({});
    for (const name of [
      "DATABASE_URL",
      "DIRECT_URL",
      "SESSION_SECRET",
      "CRON_SECRET",
      "NEXT_PUBLIC_APP_URL",
      "INGEST_ALLOWED_ORIGINS",
    ]) {
      expect(message).toContain(`${name}: is required`);
    }
  });

  it("rejects SESSION_SECRET shorter than 32 characters", () => {
    const message = messageFor({ ...valid, SESSION_SECRET: "too-short" });
    expect(message).toContain("SESSION_SECRET: must be at least 32 characters");
  });

  it("rejects CRON_SECRET shorter than 32 characters", () => {
    expect(messageFor({ ...valid, CRON_SECRET: "x".repeat(31) })).toContain("CRON_SECRET");
  });

  it("rejects a DATABASE_URL that is not a postgres URL", () => {
    expect(messageFor({ ...valid, DATABASE_URL: "mysql://user@host/db" })).toContain(
      "DATABASE_URL: must be a postgres:// or postgresql:// URL",
    );
  });

  it("never prints variable values in the error message", () => {
    const secretValue = "super-secret-value-that-is-short";
    const message = messageFor({ ...valid, SESSION_SECRET: secretValue.slice(0, 20) });
    expect(message).not.toContain(secretValue.slice(0, 20));
    expect(message).not.toContain("pass@");
  });

  it("requires APP_PASSWORD_HASH only in production", () => {
    expect(() => parseServerEnv({ ...valid, NODE_ENV: "development" })).not.toThrow();
    expect(messageFor({ ...valid, NODE_ENV: "production" })).toContain(
      "APP_PASSWORD_HASH: is required in production",
    );
    expect(
      parseServerEnv({ ...valid, NODE_ENV: "production", APP_PASSWORD_HASH: HASH }),
    ).toBeTruthy();
  });

  it("rejects a malformed APP_PASSWORD_HASH", () => {
    expect(messageFor({ ...valid, APP_PASSWORD_HASH: "plain-password" })).toContain(
      "APP_PASSWORD_HASH: must be a bcrypt hash",
    );
  });

  it("rejects ingest origins that include a path or use plain http on a public host", () => {
    expect(
      messageFor({ ...valid, INGEST_ALLOWED_ORIGINS: "https://predigoal.com/path" }),
    ).toContain("INGEST_ALLOWED_ORIGINS");
    expect(messageFor({ ...valid, INGEST_ALLOWED_ORIGINS: "http://predigoal.com" })).toContain(
      "INGEST_ALLOWED_ORIGINS",
    );
  });

  it("treats empty-string optional variables as not set", () => {
    const env = parseServerEnv({ ...valid, PROVIDER_API_BASE: "", PROVIDER_API_KEY: "" });
    expect(env.PROVIDER_API_BASE).toBeUndefined();
    expect(env.PROVIDER_API_KEY).toBeUndefined();
  });
});

describe("public env module", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("exposes only NEXT_PUBLIC_ variables and none of the server secrets", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("SESSION_SECRET", "s".repeat(40));
    const { publicEnv } = await import("@/lib/env.public");
    const keys = Object.keys(publicEnv);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((key) => key.startsWith("NEXT_PUBLIC_"))).toBe(true);
    expect(JSON.stringify(publicEnv)).not.toContain("s".repeat(40));
  });
});
