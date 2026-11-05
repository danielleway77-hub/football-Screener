import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  overline?: string;
  title: string;
  description?: string;
  /** Right-aligned on >= 768px, below the text on phones. */
  actions?: React.ReactNode;
  as?: "h1" | "h2";
  className?: string;
};

export function SectionHeader({
  overline,
  title,
  description,
  actions,
  as: Heading = "h1",
  className,
}: SectionHeaderProps) {
  return (
    <header
      className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}
    >
      <div className="min-w-0 space-y-2">
        {overline ? <p className="text-overline text-faint">{overline}</p> : null}
        <Heading className={Heading === "h1" ? "text-h1" : "text-h2"}>{title}</Heading>
        {description ? (
          <p className="text-body-sm max-w-[60ch] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
