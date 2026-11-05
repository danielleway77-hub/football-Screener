"use client";

import * as React from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ScrollFade } from "@/components/shared/ScrollFade";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { StickyBar } from "@/components/shared/StickyBar";

export function StickyDemo() {
  const [day, setDay] = React.useState("upcoming");
  return (
    <PageContainer width="wide">
      <h1 className="text-h1 mb-4">Sticky bar</h1>
      <StickyBar>
        {(stuck) => (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <ScrollFade aria-label="Days">
                <SegmentedControl
                  aria-label="Day"
                  className="shrink-0"
                  value={day}
                  onChange={setDay}
                  options={[
                    { value: "upcoming", label: "Upcoming", count: 3 },
                    { value: "today", label: "Today", count: 0 },
                    { value: "tomorrow", label: "Tomorrow", count: 2 },
                  ]}
                />
              </ScrollFade>
            </div>
            <span
              className="num text-caption hidden shrink-0 text-faint sm:inline"
              data-testid="stuck-label"
            >
              {stuck ? "docked" : "in flow"}
            </span>
          </div>
        )}
      </StickyBar>
      <ul className="mt-6 space-y-3">
        {Array.from({ length: 40 }, (_, i) => (
          <li key={i} className="surface-1 rounded-lg p-5">
            Row {i + 1} — scroll to dock the bar under the navbar.
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
