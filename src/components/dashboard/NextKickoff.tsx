"use client";

import { formatInTimeZone } from "date-fns-tz";
import { useNowTick } from "@/hooks/useNowTick";
import { formatCountdown } from "@/lib/format";

type NextKickoffProps = {
  kickoffIso: string;
  /** Server clock at render time (so the first client render equals the server HTML). */
  nowIso: string;
  timezone: string;
};

/** "Next kickoff  Wed 19:45 · in 5 h 12 m": recalculated every 60 s, paused while the tab is hidden. */
export function NextKickoff({ kickoffIso, nowIso, timezone }: NextKickoffProps) {
  const now = useNowTick(nowIso);
  const kickoff = new Date(kickoffIso);
  return (
    <p data-testid="next-kickoff" className="text-caption num text-muted-foreground">
      <span className="font-sans text-faint">Next kickoff </span>
      {formatInTimeZone(kickoff, timezone, "EEE HH:mm")} ·{" "}
      {formatCountdown(kickoff.getTime() - now)}
    </p>
  );
}
