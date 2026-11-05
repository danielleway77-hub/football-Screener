import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  /** Lucide icon in a soft circle. Replaced by `illustration` when one is supplied (Step 3.5). */
  icon?: LucideIcon;
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  /** Primary and secondary actions (buttons/links). */
  actions?: React.ReactNode;
  className?: string;
};

/** Centred empty view: icon/illustration, title, ≤ 3 lines of text, one primary action. */
export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  actions,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className={cn(
        "mx-auto flex max-w-[480px] flex-col items-center px-6 py-12 text-center",
        className,
      )}
    >
      {illustration ? (
        <div className="mb-5 text-faint">{illustration}</div>
      ) : Icon ? (
        <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon className="size-7" aria-hidden="true" />
        </div>
      ) : null}
      <h3 className="text-h3">{title}</h3>
      {description ? (
        <p className="text-body-sm mt-2 text-muted-foreground">{description}</p>
      ) : null}
      {actions ? (
        <div className="mt-6 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
