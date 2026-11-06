"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { initials } from "./logic";

const SIZES = { 28: "size-7", 40: "size-10", 56: "size-14" } as const;

type TeamLogoProps = {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
};

/**
 * Fixed-size crest. `unoptimized` because the data source's image hosts are unknown until the access
 * recon (Step 0.7): any https host works without a remotePatterns entry. Only https URLs are
 * accepted; absent or broken images fall back to the first two letters (no layout shift either way).
 */
export function TeamLogo({ name, src, size = 28, className }: TeamLogoProps) {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const usable = src && /^https:\/\//i.test(src) && failedSrc !== src ? src : null;
  return (
    <span
      data-testid="team-logo"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-hairline bg-surface-raised",
        SIZES[size],
        className,
      )}
    >
      {usable ? (
        <Image
          src={usable}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="size-full object-contain"
          onError={() => setFailedSrc(usable)}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "num font-semibold text-muted-foreground",
            size === 28 ? "text-xs" : "text-sm",
          )}
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}
