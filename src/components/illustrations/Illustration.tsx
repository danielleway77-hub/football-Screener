import { cn } from "@/lib/utils";

export type IllustrationProps = {
  /** Rendered width in px (height keeps the 4:3 ratio of the 160×120 viewBox). */
  size?: number;
  /** When given the SVG is announced as an image; otherwise it is decorative (aria-hidden). */
  title?: string;
  /** Run the 600ms stroke draw-on (disabled automatically under reduced motion). */
  draw?: boolean;
  className?: string;
};

/**
 * Shared frame for the on-brand illustrations (UI_BLUEPRINT §32): 160×120 viewBox, 1.5px round
 * strokes, `currentColor` for the neutral strokes (set a text colour on a parent), plus at most ONE
 * accent colour taken from tokens (`var(--primary)` / `var(--negative)`). No gradients, no raster.
 */
export function Illustration({
  size = 160,
  title,
  draw = false,
  className,
  children,
}: IllustrationProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 160 120"
      width={size}
      height={(size * 120) / 160}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      data-draw={draw ? "" : undefined}
      className={cn("shrink-0", className)}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** Marks a path so `data-draw` animates it (pathLength normalised to 1). */
export const drawProps = { pathLength: 1, className: "illustration-draw" } as const;
