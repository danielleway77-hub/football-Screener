import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("tooling", () => {
  it("resolves the @/ path alias and merges class names", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
