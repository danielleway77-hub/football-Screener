import { describe, expect, it } from "vitest";
import { isActivePath, NAV_LINKS } from "@/lib/nav";

describe("isActivePath", () => {
  it("marks the dashboard active only on the exact root path", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/runs", "/")).toBe(false);
  });

  it("marks a section active on its path and sub-paths, not on look-alikes", () => {
    expect(isActivePath("/runs", "/runs")).toBe(true);
    expect(isActivePath("/runs/abc", "/runs")).toBe(true);
    expect(isActivePath("/runs-archive", "/runs")).toBe(false);
  });

  it("handles a null pathname", () => {
    expect(isActivePath(null, "/")).toBe(false);
  });

  it("defines the four links in the agreed order", () => {
    expect(NAV_LINKS.map((l) => l.label)).toEqual(["Dashboard", "Runs", "Import", "Settings"]);
  });
});
