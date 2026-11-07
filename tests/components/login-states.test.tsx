import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LoginFormSkeleton } from "@/components/auth/LoginSkeleton";
import { PitchBackdrop } from "@/components/auth/PitchBackdrop";
import { NotFoundView } from "@/components/states/NotFoundView";

describe("login + 404 states (SSR)", () => {
  it("skeleton is decorative and has no live text", () => {
    const html = renderToStaticMarkup(<LoginFormSkeleton />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/>[A-Za-z]/);
  });
  it("pitch backdrop is aria-hidden and static", () => {
    const html = renderToStaticMarkup(<PitchBackdrop />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("animate");
  });
  it("404 renders its final state on the server (nothing hidden)", () => {
    const html = renderToStaticMarkup(<NotFoundView />);
    expect(html).toContain("Page not found");
    expect(html).toContain("Back to dashboard");
    expect(html).not.toContain("opacity:0");
  });
});
