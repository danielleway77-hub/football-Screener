import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DocumentUploadIllustration,
  FunnelIllustration,
  FunnelSearchIllustration,
  NotFoundIllustration,
  PlugPulseIllustration,
  RadarIllustration,
  SignalLostIllustration,
  illustrationFor,
  type IllustrationVariant,
} from "@/components/illustrations";
import { Logo } from "@/components/shared/Logo";

const ROOT = path.resolve(import.meta.dirname, "../..");
const ALL = {
  Radar: RadarIllustration,
  PlugPulse: PlugPulseIllustration,
  DocumentUpload: DocumentUploadIllustration,
  Funnel: FunnelIllustration,
  FunnelSearch: FunnelSearchIllustration,
  SignalLost: SignalLostIllustration,
  NotFound: NotFoundIllustration,
};

describe.each(Object.entries(ALL))("%s illustration", (_name, Component) => {
  it("uses the 160×120 viewBox with 1.5px round strokes and no fill by default", () => {
    const { container } = render(<Component />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("viewBox", "0 0 160 120");
    expect(svg).toHaveAttribute("stroke-width", "1.5");
    expect(svg).toHaveAttribute("stroke-linecap", "round");
    expect(svg).toHaveAttribute("stroke-linejoin", "round");
    expect(svg).toHaveAttribute("fill", "none");
  });

  it("is decorative (aria-hidden) unless a title is given", () => {
    const { container, rerender } = render(<Component />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("svg")).not.toHaveAttribute("role");
    rerender(<Component title="Nothing here" />);
    expect(screen.getByRole("img", { name: "Nothing here" })).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toHaveAttribute("aria-hidden");
  });

  it("is smaller than 2 KB", () => {
    expect(renderToStaticMarkup(<Component />).length).toBeLessThan(2048);
  });

  it("scales by `size` keeping the 4:3 ratio", () => {
    const { container } = render(<Component size={80} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "80");
    expect(svg).toHaveAttribute("height", "60");
  });

  it("draws on only when asked", () => {
    const { container, rerender } = render(<Component />);
    expect(container.querySelector("svg")).not.toHaveAttribute("data-draw");
    rerender(<Component draw />);
    expect(container.querySelector("svg")).toHaveAttribute("data-draw");
  });
});

describe("illustration source rules", () => {
  it("contains no hex or rgb colours: only currentColor and theme tokens", () => {
    for (const file of ["Illustration.tsx", "index.tsx"]) {
      const source = readFileSync(path.join(ROOT, "src/components/illustrations", file), "utf8");
      expect(source, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source, file).not.toMatch(/rgba?\(/);
    }
  });

  it("uses at most one accent token per illustration (primary OR negative, never a rainbow)", () => {
    for (const [name, Component] of Object.entries(ALL)) {
      const html = renderToStaticMarkup(<Component />);
      const accents = new Set(
        html.match(/var\(--(?:primary|negative|positive|warning|info|violet)(?:-soft)?\)/g),
      );
      const families = new Set([...accents].map((a) => a.replace("-soft", "")));
      expect(families.size, name).toBeLessThanOrEqual(1);
    }
  });
});

describe("illustrationFor", () => {
  const variants: IllustrationVariant[] = [
    "no-data-api",
    "no-data-helper",
    "no-data-import",
    "none-qualify",
    "filtered-out",
    "error",
    "offline",
    "not-found",
  ];

  it("returns an SVG for every empty/error variant", () => {
    for (const v of variants) {
      expect(renderToStaticMarkup(illustrationFor(v)), v).toContain("<svg");
    }
  });

  it("maps variants to the intended illustrations", () => {
    const html = (v: IllustrationVariant) => renderToStaticMarkup(illustrationFor(v));
    expect(html("no-data-api")).toBe(renderToStaticMarkup(<RadarIllustration />));
    expect(html("no-data-helper")).toBe(renderToStaticMarkup(<PlugPulseIllustration />));
    expect(html("no-data-import")).toBe(renderToStaticMarkup(<DocumentUploadIllustration />));
    expect(html("none-qualify")).toBe(renderToStaticMarkup(<FunnelIllustration />));
    expect(html("filtered-out")).toBe(renderToStaticMarkup(<FunnelSearchIllustration />));
    expect(html("error")).toBe(renderToStaticMarkup(<SignalLostIllustration />));
    expect(html("offline")).toBe(html("error"));
    expect(html("not-found")).toBe(renderToStaticMarkup(<NotFoundIllustration />));
  });

  it("passes props through (size, title)", () => {
    const html = renderToStaticMarkup(
      illustrationFor("error", { size: 80, title: "Connection lost" }),
    );
    expect(html).toContain('width="80"');
    expect(html).toContain("Connection lost");
  });
});

describe("logo and icon assets", () => {
  it("Logo has the accessible name Screener", () => {
    render(<Logo />);
    expect(screen.getByRole("img", { name: "Screener" })).toBeInTheDocument();
  });

  it("Logo glyph follows the spec geometry (circle r8, halfway line, lime scan line with end ticks)", () => {
    const html = renderToStaticMarkup(<Logo variant="glyph" />);
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('r="8"');
    expect(html).toContain('x1="12" y1="2.5" x2="12" y2="21.5"');
    expect(html).toContain('stroke-opacity="0.4"');
    expect(html).toContain('x1="2" y1="12" x2="22" y2="12"');
    expect(html).toContain('stroke="var(--primary)"');
  });

  /** PNG IHDR holds width/height at bytes 16–23 (big-endian). */
  const dimensions = (file: string) => {
    const buf = readFileSync(path.join(ROOT, file));
    expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a"); // PNG signature
    return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  };

  it.each([
    ["src/app/apple-icon.png", 180],
    ["public/icons/icon-32.png", 32],
    ["public/icons/icon-192.png", 192],
    ["public/icons/icon-512.png", 512],
  ])("%s is a %ipx PNG", (file, size) => {
    expect(dimensions(file)).toEqual([size, size]);
  });

  it("icon.svg is the Screener glyph on the dark base with a lime scan line", () => {
    const svg = readFileSync(path.join(ROOT, "src/app/icon.svg"), "utf8");
    expect(svg).toContain("#070A09");
    expect(svg).toContain("#C8F52E");
    expect(svg).toContain("#F2F7F4");
  });
});
