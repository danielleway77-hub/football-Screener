import { describe, expect, it } from "vitest";
import * as matches from "@/server/repositories/matches";
import * as matchService from "@/server/services/match-service";
import { loadFixtureMatches } from "../fixtures/load";
import { setupTestDb } from "./helpers";

setupTestDb();

const HOUR = 3_600_000;
const base = loadFixtureMatches()[0]!;
const row = (id: string, hoursFromNow: number, now: Date, qualifies = true) => ({
  ...base,
  providerMatchId: id,
  homeName: `Home ${id}`,
  awayName: `Away ${id}`,
  kickoffAt: new Date(now.getTime() + hoursFromNow * HOUR),
  qualifies,
});

describe("getMatch pager neighbours (upcoming only)", () => {
  it("walks only upcoming qualifying matches and skips non-qualifying ones", async () => {
    const now = new Date();
    const saved = await matches.upsertMany(
      [
        row("past", -5, now),
        row("a", 2, now),
        row("skip", 3, now, false),
        row("b", 4, now),
        row("c", 6, now),
      ],
      null,
    );
    const id = (k: string) => saved.find((m) => m.providerMatchId === k)!.id;

    const mid = await matchService.getMatch(id("b"), now);
    expect(mid?.previous?.providerMatchId).toBe("a");
    expect(mid?.next?.providerMatchId).toBe("c");

    const first = await matchService.getMatch(id("a"), now);
    expect(first?.previous).toBeNull(); // the past match is not part of the set
    expect(first?.next?.providerMatchId).toBe("b");

    const last = await matchService.getMatch(id("c"), now);
    expect(last?.next).toBeNull();

    // Without `now` (old behaviour) the past match is still a neighbour.
    expect((await matchService.getMatch(id("a")))?.previous?.providerMatchId).toBe("past");
    expect(await matchService.getMatch("no-such-id", now)).toBeNull();
  });
});
