import { InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type HelperTextProps = React.ComponentProps<"p"> & {
  /** Hide the leading icon (e.g. inside dense forms). */
  noIcon?: boolean;
};

/**
 * Visible reason text for disabled controls ("You're offline. Reconnect to save."). Never rely on a
 * tooltip for this — touch users cannot hover.
 */
export function HelperText({ className, children, noIcon = false, ...props }: HelperTextProps) {
  return (
    <p className={cn("mt-1.5 flex items-center gap-1.5 text-xs text-faint", className)} {...props}>
      {noIcon ? null : <InfoIcon className="size-3.5 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </p>
  );
}
