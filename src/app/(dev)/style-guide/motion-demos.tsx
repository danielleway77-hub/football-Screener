"use client";

import * as React from "react";
import { AnimatedBar } from "@/components/motion/AnimatedBar";
import { CountUp } from "@/components/motion/CountUp";
import { PressableScale } from "@/components/motion/PressableScale";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { Button } from "@/components/ui/button";
import { formatPct } from "@/lib/format";

const BARS = [
  { label: "Home win", pct: 76 },
  { label: "Draw", pct: 16 },
  { label: "Away win", pct: 8 },
];

/**
 * Specimens for Step 3.3. "Replay" remounts the block so every wrapper animates again (content that
 * mounts after hydration animates; the very first server paint never does). To see reduced motion,
 * use DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce" and press Replay.
 */
export function MotionDemos() {
  const [run, setRun] = React.useState(0);

  return (
    <div className="space-y-8">
      <Button variant="secondary" size="sm" onClick={() => setRun((n) => n + 1)}>
        Replay
      </Button>

      <div key={run} className="space-y-8" data-testid="motion-stage">
        <div className="space-y-2">
          <h3 className="text-overline text-muted-foreground">Reveal</h3>
          <Reveal className="surface-2 rounded-lg p-4">
            <p className="text-body-sm">Fades in and rises 8px the first time it is in view.</p>
          </Reveal>
        </div>

        <div className="space-y-2">
          <h3 className="text-overline text-muted-foreground">CountUp (once, tabular digits)</h3>
          <div className="flex gap-8">
            <CountUp value={80} format={formatPct} className="text-stat-xl" />
            <CountUp value={76} format={formatPct} className="text-stat-xl" />
            <CountUp value={3} className="text-stat-xl" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-overline text-muted-foreground">AnimatedBar (staggered by index)</h3>
          {BARS.map((bar, i) => (
            <div key={bar.label} className="space-y-1">
              <p className="text-caption text-muted-foreground">
                {bar.label} · {bar.pct}%
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-track" data-testid="bar-track">
                <AnimatedBar
                  pct={bar.pct}
                  index={i}
                  className="bg-primary"
                  data-testid="bar-fill"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <h3 className="text-overline text-muted-foreground">Stagger (first 8 of 10 animate)</h3>
          <Stagger className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => (
              <StaggerItem
                key={i}
                index={i}
                className="surface-2 rounded-md p-3 text-center text-sm"
              >
                Item {i + 1}
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <div className="space-y-2">
          <h3 className="text-overline text-muted-foreground">PressableScale</h3>
          <PressableScale className="surface-2 w-fit cursor-pointer rounded-lg px-5 py-4">
            <span className="text-sm font-medium">Press and hold me</span>
          </PressableScale>
        </div>
      </div>
    </div>
  );
}
