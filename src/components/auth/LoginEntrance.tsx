"use client";

import * as React from "react";
import { LOGIN_IMPORT_TIMEOUT_MS, LOGIN_TIMELINE as T } from "@/lib/login-motion";
import { cn } from "@/lib/utils";

type Props = { children: React.ReactNode; className?: string };

/**
 * Wraps the login page. The server markup is the FINAL state (no JS, SSR and first paint show everything);
 * after hydration a GSAP timeline plays once: glow → logo → card → fields → glyph line draw-on.
 * GSAP is imported dynamically HERE ONLY (it is in no other route's bundle). Reduced motion: no timeline,
 * no drift. If the chunk is slow (> 600 ms) the entrance is skipped rather than blanking visible content.
 * Targets are found by data attributes: [data-login-glow|logo|card|field|glyph].
 */
export function LoginEntrance({ children, className }: Props) {
  const rootRef = React.useRef<HTMLElement>(null);
  const [phase, setPhase] = React.useState<"idle" | "running" | "done" | "skipped">("idle");

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // Read the preference here (not via a hook): no gsap request is even made for reduced motion.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      queueMicrotask(() => setPhase("skipped"));
      return;
    }
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    const started = performance.now();

    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), LOGIN_IMPORT_TIMEOUT_MS),
    );
    // Never touch the form's DOM before React has hydrated it (the Suspense boundary hydrates late).
    const formReady = new Promise<void>((resolve) => {
      const t0 = performance.now();
      const tick = () => {
        const f = root.querySelector("[data-testid='login-form']");
        if (f?.getAttribute("data-hydrated") === "true" || performance.now() - t0 > 1500) resolve();
        else requestAnimationFrame(tick);
      };
      tick();
    });
    void Promise.race([
      Promise.all([import("gsap").then((m) => m.gsap), formReady]).then(([g]) => g),
      timeout,
    ]).then((gsap) => {
      if (cancelled) return;
      if (!gsap) {
        setPhase("skipped");
        return;
      }
      const q = (name: string) => gsap.utils.toArray<HTMLElement>(`[data-login-${name}]`, root);
      const lines = gsap.utils.toArray<SVGGeometryElement>(
        "[data-login-glyph] circle, [data-login-glyph] line",
        root,
      );
      setPhase("running");
      const ctx = gsap.context(() => {
        const tl = gsap.timeline({
          defaults: { overwrite: "auto" },
          onComplete: () => {
            // Leave no inline transforms/opacity behind: the rest state is the stylesheet's.
            gsap.set([q("glow"), q("logo"), q("card"), q("field")], { clearProps: "all" });
            gsap.set(lines, { clearProps: "strokeDasharray,strokeDashoffset" });
            root.dataset.entranceMs = String(Math.round(performance.now() - started));
            setPhase("done");
          },
        });
        tl.fromTo(
          q("glow"),
          { opacity: 0 },
          { opacity: 1, duration: T.glow.duration, ease: "power1.out" },
          T.glow.at,
        )
          .fromTo(
            q("logo"),
            { y: T.logo.y, opacity: 0 },
            { y: 0, opacity: 1, duration: T.logo.duration, ease: T.logo.ease },
            T.logo.at,
          )
          .fromTo(
            q("card"),
            { y: T.card.y, opacity: 0 },
            { y: 0, opacity: 1, duration: T.card.duration, ease: T.card.ease },
            T.card.at,
          )
          .fromTo(
            q("field"),
            { y: T.fields.y, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: T.fields.duration,
              ease: T.fields.ease,
              stagger: T.fields.stagger,
            },
            T.fields.at,
          );
        if (lines.length > 0) {
          tl.fromTo(
            lines,
            {
              strokeDasharray: (_i: number, el: SVGGeometryElement) => el.getTotalLength(),
              strokeDashoffset: (_i: number, el: SVGGeometryElement) => el.getTotalLength(),
            },
            { strokeDashoffset: 0, duration: T.glyph.duration, ease: T.glyph.ease },
            T.glyph.at,
          );
        }
      }, root);
      cleanup = () => ctx.revert();
    });

    // Ambient drift pauses while the tab is hidden (CSS reads data-paused on the glow).
    const onVisibility = () => {
      root.dataset.tabHidden = document.hidden ? "true" : "false";
    };
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      cleanup?.();
    };
  }, []);

  return (
    <main
      id="main"
      ref={rootRef}
      data-login-entrance={phase}
      className={cn("login-root", className)}
    >
      {children}
    </main>
  );
}
