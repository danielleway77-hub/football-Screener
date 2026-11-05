import { Logo } from "@/components/shared/Logo";
import { cn } from "@/lib/utils";

type FooterProps = {
  /** Optional data-freshness text, e.g. "Data updated Today 06:58" (formatted by the caller). */
  lastUpdated?: string;
  className?: string;
};

export function Footer({ lastUpdated, className }: FooterProps) {
  return (
    <footer className={cn("border-t border-hairline py-8", className)}>
      <div className="container-wide flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="flex items-center gap-3">
          <Logo variant="glyph" size={20} />
          <span className="text-caption text-faint">Screener · private use</span>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <p className="text-caption max-w-[60ch] text-faint md:text-right">
            Personal use only. Probabilities come from the data source; this tool does not give
            betting advice.
          </p>
          {lastUpdated ? <p className="text-caption num text-faint">{lastUpdated}</p> : null}
        </div>
      </div>
    </footer>
  );
}
