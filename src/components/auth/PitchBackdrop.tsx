/**
 * Static pitch markings (centre circle + halfway line) behind the sign-in card: a quiet brand cue.
 * Pure server markup, no JS and no animation, 5% foreground ink so it never competes with the card.
 */
export function PitchBackdrop() {
  return (
    <svg
      aria-hidden="true"
      data-login-pitch
      viewBox="0 0 800 800"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="pointer-events-none absolute top-1/2 left-1/2 size-[min(1100px,160vmin)] -translate-x-1/2 -translate-y-1/2 text-foreground opacity-[0.045]"
    >
      <circle cx="400" cy="400" r="190" />
      <circle cx="400" cy="400" r="4" fill="currentColor" />
      <line x1="0" y1="400" x2="800" y2="400" />
      <circle cx="400" cy="400" r="330" strokeDasharray="2 10" />
    </svg>
  );
}
