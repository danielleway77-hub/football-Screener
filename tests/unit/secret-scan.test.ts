import { describe, expect, it } from "vitest";
import { scanRepo, scanText } from "../../scripts/secret-scan.mjs";

// Step 16.1: the repository must contain no secrets; the scanner itself must really detect them.
describe("secret scan", () => {
  it("tracked files contain no secret-looking strings", () => {
    expect(scanRepo()).toEqual([]);
  });

  it.each([
    [
      [
        "postgre",
        "sql://neondb_owner:Zq8vK2mXr4Tb9LpW@ep-cool-name-123.eu-west-2.aws.neon.tech/neondb",
      ].join(""),
      "database URL",
    ],
    ["APP_PASSWORD_HASH='$2b$12$" + "a".repeat(53) + "'", "bcrypt"],
    [["-----BEGIN ", "PRIVATE KEY-----"].join(""), "private key"],
    [["key: AKI", "AABCDEFGHIJKLMNOP"].join(""), "AWS"],
    ["token ghp_" + "A1b2C3d4E5".repeat(4), "GitHub"],
    ["scr_" + "Ab1_".repeat(10) + "Ab1", "ingest token"],
    [["SESSION_", "SECRET=9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a"].join(""), "assignment"],
    [
      ["eyJhbGciOiJIUzI1NiJ9", "eyJ2IjoxLCJleHAiOjk5OTk5", "abcdefghijklmnopqrstuvwxyz0123"].join(
        ".",
      ),
      "JWT",
    ],
  ])("detects %s", (sample: string) => {
    expect(scanText(sample).length, sample).toBeGreaterThan(0);
  });

  it("ignores documented placeholders", () => {
    for (const ok of [
      "postgresql://user:pass@host/db",
      "postgresql://u:p@host/neondb?schema=test",
      "SESSION_SECRET=" + "s".repeat(40),
      "SESSION_SECRET=<generate with openssl rand -base64 48>",
      'process.env.SESSION_SECRET = "your-secret-here"',
    ]) {
      expect(scanText(ok), ok).toEqual([]);
    }
  });
});
