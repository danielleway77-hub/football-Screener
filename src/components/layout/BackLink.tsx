import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type BackLinkProps = {
  /** Include the previous search params in the href to preserve filters. */
  href: string;
  children?: React.ReactNode;
  className?: string;
};

export function BackLink({ href, children = "Back to dashboard", className }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "-ml-2 inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <ArrowLeftIcon className="size-4" aria-hidden="true" />
      {children}
    </Link>
  );
}
