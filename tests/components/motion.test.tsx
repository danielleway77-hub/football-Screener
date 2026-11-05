import * as React from "react";
import { useInView } from "framer-motion";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prefs = vi.hoisted(() => ({ reduce: false }));
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => prefs.reduce,
}));

import { AnimatedBar } from "@/components/motion/AnimatedBar";
import { CountUp } from "@/components/motion/CountUp";
import { PageTransition } from "@/components/motion/PageTransition";
import { PressableScale } from "@/components/motion/PressableScale";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { BAR_MAX_DELAY, DURATION, STAGGER_MAX_ITEMS, STAGGER_STEP } from "@/lib/motion";

// --- controllable IntersectionObserver ---------------------------------------------------------
type Entry = { target: Element; isIntersecting: boolean; intersectionRatio: number };
const observers: {
  cb: (entries: Entry[], o: unknown) => void;
  els: Set<Element>;
  disconnected: boolean;
}[] = [];

class IntersectionObserverStub {
  private rec = {
    cb: (() => {}) as (entries: Entry[], o: unknown) => void,
    els: new Set<Element>(),
    disconnected: false,
  };
  root = null;
  rootMargin = "";
  thresholds = [0];
  constructor(cb: (entries: Entry[], o: unknown) => void) {
    this.rec.cb = cb;
    observers.push(this.rec);
  }
  observe(el: Element) {
    this.rec.els.add(el);
  }
  unobserve(el: Element) {
    this.rec.els.delete(el);
  }
  disconnect() {
    this.rec.disconnected = true;
    this.rec.els.clear();
  }
  takeRecords() {
    return [];
  }
}

function intersect(isIntersecting: boolean) {
  act(() => {
    for (const o of observers) {
      if (o.els.size === 0) continue;
      o.cb(
        Array.from(o.els).map((target) => ({
          target,
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
        })),
        o,
      );
    }
  });
}

beforeEach(() => {
  prefs.reduce = false;
  observers.length = 0;
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
});
afterEach(() => vi.unstubAllGlobals());

describe("motion tokens", () => {
  it("match the documented values", () => {
    expect(STAGGER_STEP).toBe(0.06);
    expect(STAGGER_MAX_ITEMS).toBe(8);
    expect(BAR_MAX_DELAY).toBe(0.48);
    expect(DURATION.bar).toBe(0.7);
    expect(DURATION.countUp).toBe(0.8);
    expect(DURATION.page).toBe(0.35);
  });
});

describe("CountUp", () => {
  const pct = (v: number) => `${Math.round(v)}%`;
  const visible = () => screen.getByTestId("countup-visible");

  it("always exposes the FINAL value to assistive tech, and hides the running number", () => {
    render(<CountUp value={80} format={pct} />);
    expect(screen.getByText("80%", { selector: ".sr-only" })).toBeInTheDocument();
    expect(visible()).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the final value immediately under reduced motion", () => {
    prefs.reduce = true;
    render(<CountUp value={76} format={pct} />);
    expect(visible()).toHaveTextContent("76%");
  });

  it("snaps to the final value if reduced motion is switched on mid-count", () => {
    const { rerender } = render(<CountUp value={80} format={pct} />);
    expect(visible()).toHaveTextContent("0%"); // not yet counted: animation pending
    prefs.reduce = true;
    rerender(<CountUp value={80} format={pct} />);
    expect(visible()).toHaveTextContent("80%");
  });

  it("counts from 0 to the value once it is on screen", async () => {
    render(<CountUp value={80} format={pct} />);
    expect(visible()).toHaveTextContent("0%");
    intersect(true);
    await waitFor(() => expect(visible()).toHaveTextContent("80%"), { timeout: 3000 });
  });

  it("shows a changed value immediately instead of re-counting", () => {
    const { rerender } = render(<CountUp value={10} format={pct} />);
    rerender(<CountUp value={55} format={pct} />);
    expect(visible()).toHaveTextContent("55%");
  });

  it("uses tabular numerals", () => {
    const { container } = render(<CountUp value={3} />);
    expect(container.querySelector(".num")).not.toBeNull();
  });
});

describe("Reveal", () => {
  it("reveals once and stays revealed when scrolled away and back", () => {
    const { container } = render(<Reveal>content</Reveal>);
    const el = container.querySelector('[data-motion="reveal"]')!;
    expect(el).not.toHaveAttribute("data-revealed");
    intersect(true);
    expect(el).toHaveAttribute("data-revealed", "true");
    intersect(false);
    // Left the viewport: must STAY revealed (once), not toggle back.
    expect(el).toHaveAttribute("data-revealed", "true");
    intersect(true);
    expect(el).toHaveAttribute("data-revealed", "true");
  });

  it("renders plain content under reduced motion", () => {
    prefs.reduce = true;
    const { container } = render(<Reveal>content</Reveal>);
    expect(container.querySelector('[data-motion="reveal"]')).toBeNull();
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});

describe("Stagger", () => {
  function List({ n }: { n: number }) {
    return (
      <Stagger>
        {Array.from({ length: n }, (_, i) => (
          <StaggerItem key={i} index={i}>
            item {i}
          </StaggerItem>
        ))}
      </Stagger>
    );
  }

  it("animates at most 8 items; the rest render instantly", () => {
    const { container } = render(<List n={12} />);
    expect(container.querySelectorAll('[data-motion="animated"]')).toHaveLength(8);
    expect(container.querySelectorAll('[data-motion="static"]')).toHaveLength(4);
  });

  it("animates nothing under reduced motion", () => {
    prefs.reduce = true;
    const { container } = render(<List n={5} />);
    expect(container.querySelectorAll('[data-motion="animated"]')).toHaveLength(0);
    expect(screen.getAllByText(/item/)).toHaveLength(5);
  });
});

describe("AnimatedBar", () => {
  it("uses the final width immediately under reduced motion", () => {
    prefs.reduce = true;
    render(<AnimatedBar pct={62} data-testid="bar" />);
    expect(screen.getByTestId("bar")).toHaveStyle({ width: "62%" });
  });

  it("clamps out-of-range values to 0–100", async () => {
    const { rerender } = render(<AnimatedBar pct={150} data-testid="bar" />);
    await waitFor(() => expect(screen.getByTestId("bar").style.width).toBe("100%"), {
      timeout: 3000,
    });
    rerender(<AnimatedBar pct={-20} data-testid="bar" />);
    await waitFor(() => expect(screen.getByTestId("bar").style.width).toBe("0%"), {
      timeout: 3000,
    });
  });
});

describe("PageTransition and PressableScale", () => {
  it("render their children (animated or plain)", () => {
    const { rerender } = render(
      <PageTransition>
        <p>page</p>
      </PageTransition>,
    );
    expect(screen.getByText("page")).toBeInTheDocument();
    prefs.reduce = true;
    rerender(
      <PressableScale>
        <p>tap</p>
      </PressableScale>,
    );
    expect(screen.getByText("tap")).toBeInTheDocument();
  });
});

describe("test double sanity (IntersectionObserver stub)", () => {
  it("delivers both enter and leave events to Framer's useInView", () => {
    function Probe() {
      const ref = React.useRef<HTMLDivElement>(null);
      const inView = useInView(ref, { once: false });
      return (
        <div ref={ref} data-testid="probe">
          {inView ? "in" : "out"}
        </div>
      );
    }
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("out");
    intersect(true);
    expect(screen.getByTestId("probe")).toHaveTextContent("in");
    intersect(false);
    expect(screen.getByTestId("probe")).toHaveTextContent("out");
  });
});
