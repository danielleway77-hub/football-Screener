import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIntersectionStub } from "../helpers/intersection";

const prefs = vi.hoisted(() => ({ reduce: false, hover: true }));
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => prefs.reduce,
}));

import { SpotlightCard } from "@/components/motion/SpotlightCard";
import { ScrollFade } from "@/components/shared/ScrollFade";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { StickyBar } from "@/components/shared/StickyBar";

const io = createIntersectionStub();

beforeEach(() => {
  prefs.reduce = false;
  prefs.hover = true;
  io.install();
  window.matchMedia = ((query: string) => ({
    matches: query.includes("hover: hover") ? prefs.hover : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia;
  // run animation frames synchronously
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => vi.unstubAllGlobals());

describe("SpotlightCard", () => {
  it("tracks the pointer on hover-capable devices (sets --mx/--my, shows the overlay)", () => {
    render(<SpotlightCard>content</SpotlightCard>);
    const host = document.querySelector("[data-spotlight]") as HTMLElement;
    expect(host).toHaveAttribute("data-spotlight", "active");
    fireEvent.pointerEnter(host);
    fireEvent.pointerMove(host, { clientX: 40, clientY: 25 });
    expect(host.style.getPropertyValue("--mx")).toBe("40px");
    expect(host.style.getPropertyValue("--my")).toBe("25px");
    expect(screen.getByTestId("spotlight-overlay")).toHaveStyle({ opacity: "1" });
    fireEvent.pointerLeave(host);
    expect(screen.getByTestId("spotlight-overlay")).toHaveStyle({ opacity: "0" });
  });

  it("attaches nothing on touch devices: no overlay, no custom properties", () => {
    prefs.hover = false;
    render(<SpotlightCard>content</SpotlightCard>);
    const host = document.querySelector("[data-spotlight]") as HTMLElement;
    expect(host).toHaveAttribute("data-spotlight", "off");
    fireEvent.pointerMove(host, { clientX: 40, clientY: 25 });
    expect(host.style.getPropertyValue("--mx")).toBe("");
    expect(screen.queryByTestId("spotlight-overlay")).not.toBeInTheDocument();
  });

  it("is inert with reduced motion", () => {
    prefs.reduce = true;
    render(<SpotlightCard>content</SpotlightCard>);
    const host = document.querySelector("[data-spotlight]") as HTMLElement;
    fireEvent.pointerMove(host, { clientX: 5, clientY: 5 });
    expect(host).toHaveAttribute("data-spotlight", "off");
    expect(host.style.getPropertyValue("--mx")).toBe("");
  });

  it("keeps the content above the overlay and still renders it", () => {
    render(<SpotlightCard>hello</SpotlightCard>);
    expect(screen.getByText("hello").className).toContain("z-10");
  });
});

describe("SegmentedControl", () => {
  const options = [
    { value: "1", label: "Tomorrow only" },
    { value: "2", label: "Tomorrow + day after" },
    { value: "3", label: "Disabled", disabled: true },
  ];
  function Harness({ initial = "1" }: { initial?: string }) {
    const [value, setValue] = React.useState(initial);
    return (
      <SegmentedControl aria-label="Window" options={options} value={value} onChange={setValue} />
    );
  }

  it("is a radiogroup with aria-checked and a roving tabindex", () => {
    render(<Harness />);
    expect(screen.getByRole("radiogroup", { name: "Window" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    expect(radios.map((r) => r.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
  });

  it("arrow keys move and select, skip disabled options and wrap", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("radio", { name: "Tomorrow only" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Tomorrow + day after" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Tomorrow + day after" })).toHaveFocus();
    await user.keyboard("{ArrowRight}"); // wraps past the disabled option
    expect(screen.getByRole("radio", { name: "Tomorrow only" })).toBeChecked();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Tomorrow + day after" })).toBeChecked();
  });

  it("Home and End jump to the first and last enabled option", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2" />);
    screen.getByRole("radio", { name: "Tomorrow + day after" }).focus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("radio", { name: "Tomorrow only" })).toBeChecked();
    await user.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "Tomorrow + day after" })).toBeChecked();
  });

  it("clicking selects; a disabled option cannot be selected", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: "Tomorrow + day after" }));
    expect(screen.getByRole("radio", { name: "Tomorrow + day after" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Disabled" })).toBeDisabled();
  });

  it("scrolls inside itself instead of widening the page (max-w-full + overflow-x-auto)", () => {
    render(
      <SegmentedControl
        aria-label="Many"
        options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `Option number ${n}` }))}
        value="1"
        onChange={() => {}}
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "Many" });
    expect(group.className).toContain("max-w-full");
    expect(group.className).toContain("overflow-x-auto");
    screen.getAllByRole("radio").forEach((r) => expect(r.className).toContain("shrink-0"));
  });
  it("shows count pills when given", () => {
    render(
      <SegmentedControl
        aria-label="Day"
        options={[{ value: "t", label: "Tomorrow", count: 2 }]}
        value="t"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

describe("StickyBar", () => {
  it("reports stuck when its sentinel scrolls above the dock line, and unstuck when it returns", () => {
    const seen: boolean[] = [];
    render(<StickyBar>{(stuck) => (seen.push(stuck), (<span>bar</span>))}</StickyBar>);
    expect(screen.getByTestId("sticky-bar")).toHaveAttribute("data-stuck", "false");

    io.fire(false, -10); // sentinel above the dock line
    expect(screen.getByTestId("sticky-bar")).toHaveAttribute("data-stuck", "true");
    expect(screen.getByTestId("sticky-bar").className).toContain("glass");

    io.fire(true, 120); // back in flow
    expect(screen.getByTestId("sticky-bar")).toHaveAttribute("data-stuck", "false");
    expect(screen.getByTestId("sticky-bar").className).not.toContain("glass");
    expect(seen).toContain(true);
  });

  it("does not report stuck when the sentinel is merely below the viewport", () => {
    render(<StickyBar>bar</StickyBar>);
    io.fire(false, 5000); // not intersecting because it is far below, not because it scrolled up
    expect(screen.getByTestId("sticky-bar")).toHaveAttribute("data-stuck", "false");
  });

  it("docks under the navbar by default (top 64px, z-index 39)", () => {
    render(<StickyBar>bar</StickyBar>);
    const bar = screen.getByTestId("sticky-bar");
    expect(bar).toHaveStyle({ top: "64px" });
    expect(bar.className).toContain("z-[39]");
  });
});

describe("ScrollFade", () => {
  function setScroll(
    el: HTMLElement,
    { scrollLeft, clientWidth, scrollWidth }: Record<string, number>,
  ) {
    Object.defineProperty(el, "scrollLeft", { value: scrollLeft, configurable: true });
    Object.defineProperty(el, "clientWidth", { value: clientWidth, configurable: true });
    Object.defineProperty(el, "scrollWidth", { value: scrollWidth, configurable: true });
  }

  it("shows a fade only on the side that has more content", () => {
    render(
      <ScrollFade aria-label="Days">
        <span>a</span>
      </ScrollFade>,
    );
    const region = screen.getByRole("region", { name: "Days" });

    setScroll(region, { scrollLeft: 0, clientWidth: 200, scrollWidth: 500 });
    act(() => void fireEvent.scroll(region));
    expect(region).toHaveAttribute("data-fade-left", "false");
    expect(region).toHaveAttribute("data-fade-right", "true");

    setScroll(region, { scrollLeft: 150, clientWidth: 200, scrollWidth: 500 });
    act(() => void fireEvent.scroll(region));
    expect(region).toHaveAttribute("data-fade-left", "true");
    expect(region).toHaveAttribute("data-fade-right", "true");

    setScroll(region, { scrollLeft: 300, clientWidth: 200, scrollWidth: 500 });
    act(() => void fireEvent.scroll(region));
    expect(region).toHaveAttribute("data-fade-left", "true");
    expect(region).toHaveAttribute("data-fade-right", "false");
  });

  it("shows no fade when nothing overflows, and is keyboard focusable", () => {
    render(
      <ScrollFade aria-label="Days">
        <span>a</span>
      </ScrollFade>,
    );
    const region = screen.getByRole("region", { name: "Days" });
    setScroll(region, { scrollLeft: 0, clientWidth: 400, scrollWidth: 400 });
    act(() => void fireEvent.scroll(region));
    expect(region).toHaveAttribute("data-fade-left", "false");
    expect(region).toHaveAttribute("data-fade-right", "false");
    expect(region).toHaveAttribute("tabindex", "0");
  });
});
