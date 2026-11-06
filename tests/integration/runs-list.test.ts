import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import * as runs from "@/server/repositories/runs";
import { listRunsPage } from "@/server/services/run-service";
import { setupTestDb } from "./helpers";

setupTestDb();

async function seed(n: number, status: "SUCCESS" | "SKIPPED" = "SUCCESS") {
  const base = Date.parse("2026-11-01T00:00:00Z");
  await getDb().screeningRun.createMany({
    data: Array.from({ length: n }, (_, i) => ({
      trigger: "CRON" as const,
      provider: "official_api",
      status,
      startedAt: new Date(base + i * 60_000),
      finishedAt: new Date(base + i * 60_000 + 4000),
    })),
  });
}
const now = new Date("2026-11-05T00:00:00Z");

describe("listRunsPage", () => {
  it("pagination 20 per page capped server-side", async () => {
    await seed(45);
    const p1 = await listRunsPage({ page: 1 }, now);
    expect(p1.items).toHaveLength(20);
    expect(p1.totalPages).toBe(3);
    expect((await listRunsPage({ page: 3 }, now)).items).toHaveLength(5);
    // out-of-range page is clamped to the last page
    expect((await listRunsPage({ page: 99 }, now)).page).toBe(3);
    // repository cap: a huge pageSize never returns more than 100
    expect((await runs.list({ pageSize: 5000 })).items.length).toBeLessThanOrEqual(100);
  });

  it("hides SKIPPED by default, shows on request, filters by status", async () => {
    await seed(3);
    await seed(2, "SKIPPED");
    expect((await listRunsPage({ page: 1 }, now)).total).toBe(3);
    expect((await listRunsPage({ page: 1, showSkipped: true }, now)).total).toBe(5);
    expect(
      (await listRunsPage({ page: 1, status: "SKIPPED", showSkipped: false }, now)).total,
    ).toBe(2);
    expect((await listRunsPage({ page: 1, status: "FAILED" }, now)).total).toBe(0);
  });

  it("expires abandoned RUNNING runs on read", async () => {
    await runs.createRunning({
      trigger: "MANUAL",
      provider: "official_api",
      startedAt: new Date(now.getTime() - 30 * 60_000),
    });
    const r = await listRunsPage({ page: 1 }, now);
    expect(r.items[0]?.status).toBe("FAILED");
    expect(r.items[0]?.error).toBe(runs.ABANDONED_ERROR);
  });
});
