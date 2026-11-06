import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2Icon } from "lucide-react";
import { cn } from "cn";
import { Slot } from "radix-ui";

/**
 * Variants per ThemeGuideline §6.1 / UI_BLUEPRINT §21. Names: default = primary (lime),
 * secondary, outline, ghost, destructive, link. Sizes: sm 36 · default 44 · lg 52 (+ icon sizes).
 */
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent text-[0.9375rem] leading-none font-semibold whitespace-nowrap transition-[transform,background-color,border-color,box-shadow,color] duration-[120ms] ease-out select-none active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 aria-busy:pointer-events-none aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.125rem]",
  {
    variants: {
      variant: {
        default:
          "btn-sheen bg-primary text-primary-foreground shadow-[var(--shadow-primary)] hover:bg-primary-hover active:bg-primary-active",
        secondary:
          "surface-2 text-foreground hover:border-border-strong hover:bg-secondary-hover active:bg-secondary",
        outline:
          "border-border-control bg-transparent text-foreground hover:bg-white/5 aria-expanded:bg-white/5",
        ghost:
          "text-muted-foreground hover:bg-white/5 hover:text-foreground aria-expanded:bg-white/5 aria-expanded:text-foreground",
        destructive:
          "border-negative/40 bg-negative-soft text-negative hover:bg-negative/20 focus-visible:outline-negative",
        link: "h-auto rounded-sm px-0 font-medium text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4",
        xs: "h-8 gap-1 rounded-sm px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 rounded-md px-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "h-[3.25rem] px-6 text-base",
        icon: "size-11",
        "icon-xs": "size-8 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9",
        "icon-lg": "size-[3.25rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows a spinner in place of the icon, keeps the width, sets aria-busy and blocks clicks. */
    loading?: boolean;
  };

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      disabled={disabled}
      className={cn(buttonVariants({ variant, size, className }), loading && "cursor-progress")}
      {...props}
    >
      {loading ? (
        <>
          {/* Content stays in the layout (invisible) so the button keeps its width. */}
          <span className="invisible inline-flex items-center gap-2" aria-hidden="true">
            {children}
          </span>
          <span className="absolute inset-0 flex items-center justify-center" role="status">
            <Loader2Icon className="size-[1.125rem] animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading</span>
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
