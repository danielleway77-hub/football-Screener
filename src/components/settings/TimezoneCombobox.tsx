"use client";

import * as React from "react";
import { ChevronsUpDownIcon } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const FALLBACK_ZONES = [
  "UTC",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Lisbon",
  "Europe/Athens",
  "Europe/Istanbul",
  "Africa/Lagos",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "America/Lima",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/** IANA names from the runtime (Intl.supportedValuesOf) with a short fallback list. */
export function listTimezones(): string[] {
  try {
    const zones = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (zones && zones.length > 0) return zones.includes("UTC") ? zones : ["UTC", ...zones];
  } catch {
    // Older runtimes: use the fallback list.
  }
  return FALLBACK_ZONES;
}

/** "Europe/London (UTC+0)" — the offset is the CURRENT one for that zone (DST aware). */
export function zoneLabel(zone: string, at: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    }).formatToParts(at);
    const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const offset = raw === "GMT" ? "UTC+0" : raw.replace("GMT", "UTC");
    return `${zone.replaceAll("_", " ")} (${offset})`;
  } catch {
    return zone;
  }
}

type TimezoneComboboxProps = {
  id: string;
  value: string;
  onChange: (zone: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
};

/**
 * Searchable timezone select (WAI-ARIA combobox with a listbox popup). The popup is portalled so cards
 * with `overflow: hidden` never clip it. Keys: ↓/↑ move, Enter picks, Esc closes, typing filters.
 */
export function TimezoneCombobox({
  id,
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
}: TimezoneComboboxProps) {
  const zones = React.useMemo(() => listTimezones(), []);
  const [now] = React.useState(() => new Date());
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase().replaceAll(" ", "_");
    const list = q ? zones.filter((z) => z.toLowerCase().includes(q)) : zones;
    return list.slice(0, 120);
  }, [zones, query]);

  const listId = `${id}-list`;
  const activeId = open && filtered[active] ? `${id}-opt-${active}` : undefined;

  function pick(zone: string) {
    onChange(zone);
    setOpen(false);
    setQuery("");
    inputRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + delta + filtered.length) % Math.max(1, filtered.length));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      const zone = filtered[active];
      if (zone) pick(zone);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setQuery("");
    } else if (event.key === "Tab") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <PopoverPrimitive.Root open={open && !disabled} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div className="relative">
          <Input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            value={open ? query : zoneLabel(value, now)}
            placeholder={open ? "Search timezones" : undefined}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => {
              setQuery("");
            }}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className="pr-10"
          />
          <ChevronsUpDownIcon
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (inputRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
          className="z-[var(--z-popover)] max-h-72 w-(--radix-popover-trigger-width) min-w-60 overflow-y-auto rounded-md border border-hairline-strong bg-surface-overlay p-1 shadow-lg"
        >
          <ul id={listId} role="listbox" aria-label="Timezones">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No timezone matches.</li>
            ) : (
              filtered.map((zone, i) => (
                <li
                  key={zone}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={zone === value}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(zone)}
                  ref={(el) => {
                    if (el && i === active) el.scrollIntoView({ block: "nearest" });
                  }}
                  className={cn(
                    "flex min-h-10 cursor-pointer items-center rounded-sm px-3 py-2 text-sm",
                    i === active && "bg-primary-soft",
                    zone === value && "font-semibold text-primary",
                  )}
                >
                  {zoneLabel(zone, now)}
                </li>
              ))
            )}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
