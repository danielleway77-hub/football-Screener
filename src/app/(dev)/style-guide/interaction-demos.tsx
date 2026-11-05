"use client";

import * as React from "react";
import Link from "next/link";
import { SpotlightCard } from "@/components/motion/SpotlightCard";
import { ScrollFade } from "@/components/shared/ScrollFade";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { Button } from "@/components/ui/button";

const DAYS = ["Upcoming", "Today", "Tomorrow", "Day after", "Next week", "Archive"];

/** Specimens for Step 3.4 (signature interaction kit). */
export function InteractionDemos() {
  const [windowDays, setWindowDays] = React.useState("2");
  const [day, setDay] = React.useState("tomorrow");

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h3 className="text-overline text-muted-foreground">
          SpotlightCard (hover-capable devices only)
        </h3>
        <SpotlightCard className="surface-1 max-w-md rounded-lg">
          <div className="p-5" data-testid="spotlight-demo">
            <p className="text-h4">Sporting Cristal – FC Cajamarca</p>
            <p className="text-body-sm mt-2 text-muted-foreground">
              Move the pointer over this card. On touch screens or with reduced motion nothing
              happens.
            </p>
          </div>
        </SpotlightCard>
      </div>

      <div className="space-y-2">
        <h3 className="text-overline text-muted-foreground">SegmentedControl</h3>
        <SegmentedControl
          aria-label="Screening window"
          value={windowDays}
          onChange={setWindowDays}
          options={[
            { value: "1", label: "Tomorrow only" },
            { value: "2", label: "Tomorrow + day after" },
          ]}
        />
        <div className="pt-3">
          <SegmentedControl
            aria-label="Day"
            value={day}
            onChange={setDay}
            options={[
              { value: "upcoming", label: "Upcoming", count: 3 },
              { value: "today", label: "Today", count: 0 },
              { value: "tomorrow", label: "Tomorrow", count: 2 },
              { value: "dayafter", label: "Day after", count: 1, disabled: true },
            ]}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-overline text-muted-foreground">
          ScrollFade (resize the window narrow)
        </h3>
        <div className="max-w-xs" data-testid="scrollfade-demo">
          <ScrollFade aria-label="Example days">
            {DAYS.map((d) => (
              <span
                key={d}
                className="surface-2 shrink-0 rounded-full px-4 py-2 text-sm whitespace-nowrap"
              >
                {d}
              </span>
            ))}
          </ScrollFade>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-overline text-muted-foreground">StickyBar</h3>
        <p className="text-body-sm text-muted-foreground">
          Docks under the navbar and turns to glass when stuck. Shown inside the real shell:
        </p>
        <Button asChild variant="secondary" size="sm">
          <Link href="/style-guide/sticky">Open sticky bar demo</Link>
        </Button>
      </div>
    </div>
  );
}
