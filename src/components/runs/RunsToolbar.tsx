"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { runsHref, type StatusFilter } from "@/lib/schemas/runs";
import { cn } from "@/lib/utils";

const ALL = "ALL";
const OPTIONS: [string, string][] = [
  [ALL, "All"],
  ["SUCCESS", "Success"],
  ["PARTIAL", "Partial"],
  ["FAILED", "Failed"],
  ["RUNNING", "Running"],
];

type Props = { status: StatusFilter | null; showSkipped: boolean };

/** Status filter + "Show skipped" switch. Changing either resets to page 1 and updates the URL. */
export function RunsToolbar({ status, showSkipped }: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const go = (next: Partial<{ status: StatusFilter | null; showSkipped: boolean }>) =>
    startTransition(() => router.replace(runsHref({ status, showSkipped, ...next, page: 1 })));

  return (
    <div
      role="group"
      aria-label="Filter runs"
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-center md:justify-end",
        pending && "opacity-80",
      )}
    >
      <Select
        value={status ?? ALL}
        onValueChange={(v) => go({ status: v === ALL ? null : (v as StatusFilter) })}
      >
        <SelectTrigger
          aria-label="Status"
          data-testid="status-filter"
          className="h-11 w-full md:w-48"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="flex h-11 cursor-pointer items-center justify-between gap-3 text-sm md:justify-start">
        <span>Show skipped</span>
        <Switch
          checked={showSkipped}
          data-testid="show-skipped"
          aria-label="Show skipped"
          onCheckedChange={(checked) => go({ showSkipped: checked })}
        />
      </label>
    </div>
  );
}
