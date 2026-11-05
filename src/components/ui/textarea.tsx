import * as React from "react";
import { cn } from "cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-md border border-input bg-subtle px-3 py-2.5 text-base shadow-[var(--shadow-field)] transition-colors placeholder:text-muted-foreground hover:border-[var(--border-control-hover)] focus-visible:border-ring disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-subtle dark:disabled:bg-subtle dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
