import { act } from "@testing-library/react";
import { vi } from "vitest";

type Entry = {
  target: Element;
  isIntersecting: boolean;
  intersectionRatio: number;
  boundingClientRect: { top: number };
};
type Callback = (entries: Entry[], observer: unknown) => void;

/** Controllable IntersectionObserver for jsdom tests. Call `install()` in beforeEach. */
export function createIntersectionStub() {
  const observers: { cb: Callback; els: Set<Element>; options?: IntersectionObserverInit }[] = [];

  class Stub {
    private rec: { cb: Callback; els: Set<Element>; options?: IntersectionObserverInit };
    root = null;
    rootMargin = "";
    thresholds = [0];
    constructor(cb: Callback, options?: IntersectionObserverInit) {
      this.rec = { cb, els: new Set(), options };
      observers.push(this.rec);
    }
    observe(el: Element) {
      this.rec.els.add(el);
    }
    unobserve(el: Element) {
      this.rec.els.delete(el);
    }
    disconnect() {
      this.rec.els.clear();
    }
    takeRecords() {
      return [];
    }
  }

  return {
    observers,
    install() {
      observers.length = 0;
      vi.stubGlobal("IntersectionObserver", Stub);
    },
    /** Deliver an intersection change to every observed element. `top` = its boundingClientRect.top. */
    fire(isIntersecting: boolean, top = 0) {
      act(() => {
        for (const o of observers) {
          if (o.els.size === 0) continue;
          o.cb(
            Array.from(o.els).map((target) => ({
              target,
              isIntersecting,
              intersectionRatio: isIntersecting ? 1 : 0,
              boundingClientRect: { top },
            })),
            o,
          );
        }
      });
    },
  };
}
