import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Component tests run in jsdom, which lacks several browser APIs that Radix UI / Framer Motion use.
if (typeof window !== "undefined") {
  afterEach(() => cleanup());

  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }

  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
}
