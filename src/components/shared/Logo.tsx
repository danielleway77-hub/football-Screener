import { cn } from "@/lib/utils";

type LogoProps = {
  /** `full` = glyph + wordmark, `glyph` = glyph only (favicons, tight spaces). */
  variant?: "full" | "glyph";
  size?: 20 | 24 | 28 | 32;
  className?: string;
};

/** Pitch centre-circle with a lime scan line (geometry from UI_BLUEPRINT §32). */
export function LogoGlyph({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
      <line
        x1="12"
        y1="2.5"
        x2="12"
        y2="21.5"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1.75"
      />
      <g stroke="var(--primary)" strokeWidth="2" strokeLinecap="round">
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="2" y1="9.5" x2="2" y2="14.5" />
        <line x1="22" y1="9.5" x2="22" y2="14.5" />
      </g>
    </svg>
  );
}

export function Logo({ variant = "full", size = 28, className }: LogoProps) {
  return (
    <span
      role="img"
      aria-label="Screener"
      className={cn("inline-flex items-center gap-2.5 text-foreground", className)}
    >
      <LogoGlyph size={size} />
      {variant === "full" ? (
        <span
          aria-hidden="true"
          className="font-heading text-[15px] leading-none font-bold tracking-[0.12em]"
        >
          SCREENER
        </span>
      ) : null}
    </span>
  );
}
