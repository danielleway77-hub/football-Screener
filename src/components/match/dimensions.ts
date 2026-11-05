/**
 * Shared height of a match card. The real MatchCard (Step 10.1) and its skeleton both use these so
 * swapping skeleton → content causes zero layout shift (UI_BLUEPRINT §5).
 */
export const MATCH_CARD_MIN_HEIGHT_CLASS = "min-h-[424px] md:min-h-[440px]";
export const MATCH_CARD_MIN_HEIGHT = { mobile: 424, desktop: 440 } as const;
