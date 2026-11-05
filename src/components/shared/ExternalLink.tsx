import { ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ExternalLinkProps = Omit<React.ComponentProps<"a">, "target" | "rel">;

/** Opens in a new tab with `noopener noreferrer`, an icon and a screen-reader hint. */
export function ExternalLink({ className, children, ...props }: ExternalLinkProps) {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-primary underline decoration-1 underline-offset-4 hover:decoration-2",
        className,
      )}
      {...props}
    >
      {children}
      <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
      <span className="sr-only"> (opens in new tab)</span>
    </a>
  );
}
