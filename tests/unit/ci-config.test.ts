import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ci = readFileSync(".github/workflows/ci.yml", "utf8");

describe("CI workflow", () => {
  it("runs the required gates", () => {
    for (const step of [
      "prisma generate",
      "pnpm lint",
      "pnpm typecheck",
      "TZ=UTC",
      "TZ=Asia/Karachi",
      "pnpm build",
      "secret-scan",
    ]) {
      expect(ci).toContain(step);
    }
  });
  it("gates database jobs behind manual dispatch and uses secret names only", () => {
    expect(ci).toMatch(/integration:[\s\S]*?if: github\.event_name == 'workflow_dispatch'/);
    expect(ci).toMatch(/e2e:[\s\S]*?if: github\.event_name == 'workflow_dispatch'/);
    expect(ci).toContain("${{ secrets.DATABASE_URL_TEST }}");
    expect(ci).not.toMatch(/postgres(ql)?:\/\/[^\s:@/]+:[^\s@]+@/);
  });
  it("never deploys and keeps permissions read-only", () => {
    expect(ci).toContain("contents: read");
    expect(ci).not.toMatch(/vercel (deploy|--prod)|git push/);
  });
  it("has a dependabot config for npm and actions", () => {
    const d = readFileSync(".github/dependabot.yml", "utf8");
    expect(d).toContain("package-ecosystem: npm");
    expect(d).toContain("package-ecosystem: github-actions");
  });
});
