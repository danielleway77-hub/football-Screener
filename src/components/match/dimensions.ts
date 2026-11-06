/**
 * Shared sizes of the match card. The real MatchCard (Step 10.1) and its skeleton both use these so
 * swapping skeleton → content causes zero layout shift (UI_BLUEPRINT §5).
 */
export const MATCH_CARD_MIN_HEIGHT_CLASS = "min-h-[424px] md:min-h-[440px]";
export const MATCH_CARD_MIN_HEIGHT = { mobile: 424, desktop: 440 } as const;

/** Row heights in px (UI_BLUEPRINT §5). The Tailwind classes in the components must stay in step. */
export const MATCH_CARD_ROWS = {
  header: 28,
  kickoff: 20,
  teamBlock: 64,
  tile: 64,
  footer: 20,
  chip: 28,
  barTrack: 8,
  barTrackLarge: 12,
} as const;
