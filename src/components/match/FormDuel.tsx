"use client";

import { motion } from "framer-motion";
import { useAnimateOnMount } from "@/hooks/useAnimateOnMount";
import { DURATION, EASE_OUT, useMotionPrefs } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { formatPct } from "@/lib/format";
import { duelAriaLabel, duelLayout, type DuelSide } from "./duel-logic";
import { TeamLogo } from "./TeamLogo";

type DuelTeam = { name: string; logoUrl: string | null; pct: number };

type FormDuelProps = {
  home: DuelTeam;
  away: DuelTeam;
  low: number;
  high: number;
  /** The domain verdict. Never recomputed here. */
  qualifies: boolean;
  className?: string;
};

// Fixed 96px budget: values 0-20, track 36-48, tick labels 52-64, "below" marker 68-96.
const TRACK_TOP = 36;
const TRACK_H = 12;
const MARKER = 28;

function Marker({
  side,
  team,
  left,
  below,
  alignLabel,
  index,
  animate,
}: {
  side: DuelSide;
  team: DuelTeam;
  left: number;
  below: boolean;
  alignLabel: "center" | "start" | "end";
  index: number;
  animate: boolean;
}) {
  const centerY = TRACK_TOP + TRACK_H / 2;
  const top = below ? 68 : centerY - MARKER / 2;
  return (
    <motion.div
      data-testid={`duel-marker-${side}`}
      data-left={left}
      data-below={below || undefined}
      className="absolute z-10"
      style={{ top: 0, height: 96, width: 0 }}
      initial={animate ? { left: "0%" } : false}
      animate={{ left: `${left}%` }}
      transition={{ duration: DURATION.bar, ease: EASE_OUT, delay: index * 0.06 }}
    >
      {below ? (
        <span
          aria-hidden="true"
          data-testid="duel-leader"
          className="absolute w-px -translate-x-1/2 bg-faint"
          style={{ top: centerY + MARKER / 2, height: 68 - (centerY + MARKER / 2) }}
        />
      ) : null}
      <span
        className={cn(
          "absolute -translate-x-1/2 rounded-md bg-background ring-2 forced-colors:border forced-colors:border-[Highlight]",
          side === "home" ? "ring-foreground" : "ring-muted-foreground",
        )}
        style={{ top }}
      >
        <TeamLogo name={team.name} src={team.logoUrl} size={28} />
      </span>
      <span
        className={cn(
          "num absolute text-xs font-semibold whitespace-nowrap text-foreground",
          alignLabel === "center" && !below && "-translate-x-1/2",
          alignLabel === "end" && "-translate-x-full pr-0.5",
          alignLabel === "start" && "pl-0.5",
          below && "text-muted-foreground",
        )}
        style={
          below
            ? { top: 68 + 7, left: MARKER / 2 + 4 }
            : {
                top: 2,
                left: alignLabel === "end" ? 2 : alignLabel === "start" ? -2 : 0,
              }
        }
      >
        {formatPct(team.pct)}
      </span>
    </motion.div>
  );
}

/**
 * One-glance "why it qualifies": both teams on one 0-100 form scale with the thresholds shaded.
 * The visual is aria-hidden; a single role="img" sentence carries the meaning. Positions are percent of
 * the track (clamped 2-98); markers closer than 8 points put the lower one below the track.
 */
export function FormDuel({ home, away, low, high, qualifies, className }: FormDuelProps) {
  const { reduce } = useMotionPrefs();
  const mountAnimate = useAnimateOnMount();
  const animate = mountAnimate && !reduce;
  const L = duelLayout(home.pct, away.pct);
  const label = duelAriaLabel({
    homeName: home.name,
    awayName: away.name,
    homePct: home.pct,
    awayPct: away.pct,
    low,
    high,
    qualifies,
  });
  const centerY = TRACK_TOP + TRACK_H / 2;
  const align = (side: DuelSide) =>
    !L.spreadLabels || L.below ? "center" : side === L.higher ? "start" : ("end" as const);
  const pillText = `gap ${Math.round(L.gap * 10) / 10} pts`;
  const pillRight = (L.from + L.to) / 2 < 50;

  return (
    <div
      role="img"
      aria-label={label}
      data-testid="form-duel"
      data-qualifies={qualifies || undefined}
      className={cn("relative h-24 w-full max-w-[640px] px-3.5", className)}
    >
      <div aria-hidden="true" className="relative h-full">
        <div
          data-testid="duel-track"
          className="absolute inset-x-0 flex overflow-hidden rounded-full bg-track"
          style={{ top: TRACK_TOP, height: TRACK_H }}
        >
          <span
            data-testid="zone-low"
            className="h-full bg-negative-soft forced-colors:border-r forced-colors:border-[GrayText]"
            style={{ width: `${low}%` }}
          />
          <span
            data-testid="zone-mid"
            className="h-full bg-neutral-soft forced-colors:border-r forced-colors:border-[GrayText]"
            style={{ width: `${high - low}%` }}
          />
          <span data-testid="zone-high" className="h-full flex-1 bg-primary-soft" />
        </div>
        {[low, high].map((t) => (
          <span
            key={t}
            data-testid="duel-tick"
            data-at={t}
            className="num absolute text-xs text-muted-foreground"
            style={{ left: `${t}%`, top: TRACK_TOP + TRACK_H + 4 }}
          >
            <span className="absolute -top-1.5 left-0 h-3 w-px -translate-x-1/2 bg-border-strong" />
            <span className="block -translate-x-1/2 pt-2 leading-3">{t}%</span>
          </span>
        ))}
        <motion.span
          data-testid="duel-bracket"
          data-qualifies={qualifies || undefined}
          className={cn(
            "absolute h-0.5 -translate-y-1/2 rounded-full",
            qualifies ? "bg-primary" : "bg-faint",
          )}
          style={{ top: centerY, left: `${L.from}%`, width: `${L.to - L.from}%` }}
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: animate ? 0.7 + 0.12 : 0 }}
        />
        <motion.span
          data-testid="duel-pill"
          className={cn(
            "num absolute rounded-full border px-2 py-0.5 text-xs leading-4 font-semibold whitespace-nowrap",
            qualifies
              ? "border-primary-border bg-surface text-primary"
              : "border-hairline bg-surface text-muted-foreground",
            L.pillOnBracket
              ? "-translate-x-1/2 -translate-y-1/2"
              : cn("bottom-0", pillRight ? "right-0" : "left-0"),
          )}
          style={L.pillOnBracket ? { top: centerY, left: `${(L.from + L.to) / 2}%` } : undefined}
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: animate ? 0.7 + 0.12 : 0 }}
        >
          {pillText}
        </motion.span>
        <Marker
          side="home"
          team={home}
          left={L.homeLeft}
          below={L.below === "home"}
          alignLabel={align("home")}
          index={0}
          animate={animate}
        />
        <Marker
          side="away"
          team={away}
          left={L.awayLeft}
          below={L.below === "away"}
          alignLabel={align("away")}
          index={1}
          animate={animate}
        />
      </div>
    </div>
  );
}
