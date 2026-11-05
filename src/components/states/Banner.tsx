import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type BannerProps = {
  tone: "warning" | "positive";
  icon: LucideIcon;
  children: React.ReactNode;
  /** Right-aligned action (wraps below the text on narrow screens). */
  action?: React.ReactNode;
  className?: string;
};

const tones = {
  warning: "border-warning/40 bg-warning-soft text-foreground [&_svg:first-child]:text-warning",
  positive: "border-positive/40 bg-positive-soft text-foreground [&_svg:first-child]:text-positive",
} as const;

/** Full-width 44px (min) status strip that sits between the navbar and <main>. */
export function Banner({ tone, icon: Icon, children, action, className }: BannerProps) {
  return (
    <div
      role="status"
      data-testid="banner"
      data-tone={tone}
      className={cn("border-b px-4 py-2 text-sm", tones[tone], className)}
    >
      <div className="container-wide flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1">
        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1">{children}</p>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
