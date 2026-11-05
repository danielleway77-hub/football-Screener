"use client";

import * as React from "react";
import { SearchIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { RuleChecker } from "./rule-checker";

const SECTIONS = [
  ["colours", "Colours"],
  ["typography", "Typography"],
  ["buttons", "Buttons"],
  ["forms", "Form controls"],
  ["badges", "Badges & chips"],
  ["cards", "Cards"],
  ["feedback", "Feedback"],
  ["skeletons", "Skeletons"],
  ["tabs-table", "Tabs & table"],
  ["elevation", "Elevation & surfaces"],
] as const;

type Swatch = { token: string; group: string; text?: boolean };
const SWATCHES: Swatch[] = [
  ...[
    "--bg-base",
    "--bg-subtle",
    "--surface",
    "--surface-raised",
    "--surface-overlay",
    "--border",
    "--border-strong",
    "--border-control",
  ].map((token) => ({ token, group: "Neutrals" })),
  ...["--text", "--text-muted", "--text-faint", "--text-disabled", "--text-on-accent"].map(
    (token) => ({
      token,
      group: "Text",
      text: true,
    }),
  ),
  ...[
    "--primary",
    "--primary-hover",
    "--primary-active",
    "--primary-soft",
    "--primary-border",
    "--secondary",
    "--secondary-hover",
  ].map((token) => ({ token, group: "Brand" })),
  ...[
    "--positive",
    "--negative",
    "--warning",
    "--info",
    "--violet",
    "--neutral-signal",
    "--neutral-bar",
  ].map((token) => ({
    token,
    group: "Semantic",
  })),
  ...[
    "--positive-soft",
    "--negative-soft",
    "--warning-soft",
    "--info-soft",
    "--violet-soft",
    "--neutral-soft",
    "--track",
    "--skeleton",
  ].map((token) => ({ token, group: "Soft backgrounds & tracks" })),
  ...["--hairline", "--hairline-strong", "--scrim", "--primary-glow"].map((token) => ({
    token,
    group: "Depth",
  })),
];

const TYPE_SCALE = [
  ["text-display", "Display"],
  ["text-h1", "Heading 1"],
  ["text-h2", "Heading 2"],
  ["text-h3", "Heading 3"],
  ["text-h4", "Heading 4"],
  ["", "Body — Sporting Cristal vs FC Cajamarca"],
  ["text-body-sm", "Body small — secondary text"],
  ["text-caption", "Caption — meta text"],
  ["text-overline", "Overline label"],
  ["text-stat-xl", "80%"],
  ["text-stat", "76%"],
  ["text-stat-sm", "3 – 1"],
] as const;

function rgbToHex(value: string): string {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m?.[1]) return value;
  const [r = 0, g = 0, b = 0, a] = m[1]
    .split(/[ ,/]+/)
    .filter(Boolean)
    .map(Number);
  const hex = [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
  return a !== undefined && a < 1 ? `#${hex} @ ${Math.round(a * 100)}%` : `#${hex}`;
}

function SwatchTile({ token, text }: Swatch) {
  const [value, setValue] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (ref.current) setValue(rgbToHex(getComputedStyle(ref.current).backgroundColor));
  }, []);
  return (
    <div className="space-y-2">
      <div
        ref={ref}
        className="flex h-16 items-center justify-center rounded-md border border-hairline-strong"
        style={{ background: `var(${token})` }}
      >
        {text ? (
          <span className="text-h4" style={{ color: `var(${token})` }}>
            Aa
          </span>
        ) : null}
      </div>
      <div>
        <p className="font-mono text-xs text-foreground">{token}</p>
        <p className="font-mono text-xs text-faint">{value}</p>
      </div>
    </div>
  );
}

function Section({
  id,
  index,
  title,
  description,
  children,
}: {
  id: string;
  index: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <div>
        <p className="text-overline text-faint">{String(index).padStart(2, "0")}</p>
        <h2 className="text-h2">{title}</h2>
        <p className="text-body-sm text-muted-foreground">{description}</p>
      </div>
      <div className="surface-1 rounded-lg p-4 md:p-6">{children}</div>
    </section>
  );
}

function StateRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption text-faint">{label}</span>
      {children}
    </div>
  );
}

function BreakpointBadge() {
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const name =
    width >= 1920
      ? "3xl"
      : width >= 1536
        ? "2xl"
        : width >= 1280
          ? "xl"
          : width >= 1024
            ? "lg"
            : width >= 768
              ? "md"
              : width >= 640
                ? "sm"
                : "base";
  return (
    <div
      data-testid="breakpoint-badge"
      className="surface-2 fixed top-3 right-3 z-90 rounded-full px-3 py-1 font-mono text-xs"
    >
      {name} · {width}
    </div>
  );
}

export function StyleGuideClient() {
  const [active, setActive] = React.useState<string>(SECTIONS[0][0]);
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    SECTIONS.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const groups = Array.from(new Set(SWATCHES.map((s) => s.group)));
  let n = 0;

  return (
    <div className="container-wide pb-24" data-testid="style-guide">
      <BreakpointBadge />
      <header className="py-10">
        <p className="text-overline text-primary">Dev only</p>
        <h1 className="text-h1">Night Pitch style guide</h1>
        <p className="text-body-sm max-w-prose text-muted-foreground">
          Every specimen below uses theme tokens only. Source of truth: docs/ThemeGuideline.md and
          docs/UI_BLUEPRINT.md. This page returns 404 in production.
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <nav
          aria-label="Style guide sections"
          className="mb-8 lg:sticky lg:top-6 lg:mb-0 lg:self-start"
        >
          <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {SECTIONS.map(([id, label]) => (
              <li key={id} className="shrink-0">
                <a
                  href={`#${id}`}
                  aria-current={active === id ? "location" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground",
                    active === id && "bg-primary-soft text-primary",
                  )}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="max-w-[960px] space-y-14">
          <Section
            id="colours"
            index={++n}
            title="Colours"
            description="Tokens with their computed values. Lime is light: used only for meaning."
          >
            <div className="space-y-8">
              {groups.map((group) => (
                <div key={group} className="space-y-3">
                  <h3 className="text-overline text-muted-foreground">{group}</h3>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {SWATCHES.filter((s) => s.group === group).map((s) => (
                      <SwatchTile key={s.token} {...s} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="typography"
            index={++n}
            title="Typography"
            description="Space Grotesk headings, Inter body, JetBrains Mono numbers (tabular)."
          >
            <div className="space-y-5">
              {TYPE_SCALE.map(([cls, sample]) => (
                <div
                  key={sample}
                  className="flex flex-col gap-1 border-b border-hairline pb-4 last:border-0 last:pb-0"
                >
                  <span className="text-caption text-faint">{cls || "body (16px / 1.6)"}</span>
                  <p className={cls}>{sample}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="buttons"
            index={++n}
            title="Buttons"
            description="Variants × sizes × states. Heights: sm 36, default 44, lg 52."
          >
            <div className="space-y-8">
              {(["default", "secondary", "outline", "ghost", "destructive", "link"] as const).map(
                (variant) => (
                  <div key={variant} className="space-y-3">
                    <h3 className="text-overline text-muted-foreground">{variant}</h3>
                    <div className="flex flex-wrap items-end gap-4">
                      <StateRow label="sm">
                        <Button variant={variant} size="sm">
                          Run now
                        </Button>
                      </StateRow>
                      <StateRow label="default">
                        <Button variant={variant}>Run now</Button>
                      </StateRow>
                      <StateRow label="lg">
                        <Button variant={variant} size="lg">
                          Run now
                        </Button>
                      </StateRow>
                      <StateRow label="hover">
                        <Button variant={variant} data-force="hover">
                          Run now
                        </Button>
                      </StateRow>
                      <StateRow label="focus">
                        <Button variant={variant} data-force="focus">
                          Run now
                        </Button>
                      </StateRow>
                      <StateRow label="active">
                        <Button variant={variant} data-force="active">
                          Run now
                        </Button>
                      </StateRow>
                      <StateRow label="disabled">
                        <Button variant={variant} disabled>
                          Run now
                        </Button>
                      </StateRow>
                      <StateRow label="loading">
                        <Button variant={variant} loading>
                          Run now
                        </Button>
                      </StateRow>
                    </div>
                  </div>
                ),
              )}
            </div>
          </Section>

          <Section
            id="forms"
            index={++n}
            title="Form controls"
            description="44px controls, visible 3:1 outlines, inline errors with icon + text."
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="f-default">Default</Label>
                <Input id="f-default" placeholder="Filter by league" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-focus">Focus (forced)</Label>
                <Input id="f-focus" data-force="focus" placeholder="Focused" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-error">Error</Label>
                <Input
                  id="f-error"
                  aria-invalid
                  defaultValue="120"
                  aria-describedby="f-error-msg"
                />
                <p id="f-error-msg" className="text-body-sm text-negative">
                  Enter a value between 0 and 100.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-disabled">Disabled</Label>
                <Input id="f-disabled" disabled placeholder="Disabled" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-text">Textarea</Label>
                <Textarea id="f-text" placeholder="Paste data here" />
              </div>
              <div className="space-y-2">
                <Label>Select</Label>
                <Select defaultValue="kickoff">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kickoff">Kickoff (soonest)</SelectItem>
                    <SelectItem value="gap">Biggest form gap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="f-switch" defaultChecked />
                <Label htmlFor="f-switch">Show skipped</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="f-check" defaultChecked />
                <Label htmlFor="f-check">I understand</Label>
              </div>
              <div className="space-y-3 md:col-span-2">
                <Label>Slider</Label>
                <Slider defaultValue={[35, 75]} max={100} step={1} />
              </div>
            </div>
          </Section>

          <Section
            id="badges"
            index={++n}
            title="Badges & chips"
            description="Soft tint + translucent border. Status is never colour-only."
          >
            <div className="flex flex-wrap gap-3">
              <Badge variant="primary">QUALIFIES</Badge>
              <Badge variant="positive">
                <TrendingUpIcon /> Strong form
              </Badge>
              <Badge variant="negative">
                <TrendingDownIcon /> Poor form
              </Badge>
              <Badge variant="warning">STALE</Badge>
              <Badge variant="info">INFO</Badge>
              <Badge variant="neutral">SKIPPED</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="default">Default</Badge>
            </div>
          </Section>

          <Section
            id="cards"
            index={++n}
            title="Cards"
            description="Hairline edge, no resting shadow. Interactive cards lift on hover; qualifying cards get the accent hairline."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Default</CardTitle>
                  <CardDescription>Quiet panel</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-stat num">42</p>
                </CardContent>
              </Card>
              <Card interactive data-force="hover">
                <CardHeader>
                  <CardTitle>Interactive (hover)</CardTitle>
                  <CardDescription>Lifts 2px</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-stat num">3</p>
                </CardContent>
              </Card>
              <Card className="glow-accent accent-border">
                <CardHeader>
                  <CardTitle>Qualifying</CardTitle>
                  <CardDescription>Accent hairline + glow</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-stat num text-primary">80%</p>
                </CardContent>
              </Card>
            </div>
          </Section>

          <Section
            id="feedback"
            index={++n}
            title="Feedback"
            description="Toasts, dialog, sheet, tooltip."
          >
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => toast.success("3 qualifying matches found.")}
              >
                Success toast
              </Button>
              <Button
                variant="secondary"
                onClick={() => toast.error("The check didn't finish. Try again.")}
              >
                Error toast
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary">Open dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Revoke &quot;Home laptop&quot;?</DialogTitle>
                    <DialogDescription>The helper using it will stop working.</DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="secondary">Open sheet</Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                    <SheetDescription>Sheet content on surface-3.</SheetDescription>
                  </SheetHeader>
                </SheetContent>
              </Sheet>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary">Open menu</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Kickoff (soonest)</DropdownMenuItem>
                  <DropdownMenuItem>Biggest form gap</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost">
                    <SearchIcon /> Hover me
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Tooltip text</TooltipContent>
              </Tooltip>
            </div>
            <div className="mt-6 max-w-md space-y-2">
              <Label>Progress</Label>
              <Progress value={62} />
            </div>
          </Section>

          <Section
            id="skeletons"
            index={++n}
            title="Skeletons"
            description="Shimmer sweep; static under reduced motion."
          >
            <div className="space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-full max-w-md" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </div>
          </Section>

          <Section
            id="tabs-table"
            index={++n}
            title="Tabs & table"
            description="Tabs with a selected pill; table with right-aligned mono numbers."
          >
            <Tabs defaultValue="tomorrow">
              <TabsList>
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="tomorrow">Tomorrow</TabsTrigger>
                <TabsTrigger value="dayafter">Day after</TabsTrigger>
              </TabsList>
              <TabsContent value="tomorrow" className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Match</TableHead>
                      <TableHead className="text-right">Home form</TableHead>
                      <TableHead className="text-right">Away form</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Sporting Cristal – FC Cajamarca</TableCell>
                      <TableCell className="num text-right">80%</TableCell>
                      <TableCell className="num text-right">7%</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Atlético Madrid – Bayern München</TableCell>
                      <TableCell className="num text-right">44%</TableCell>
                      <TableCell className="num text-right">56%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </Section>

          <Section
            id="elevation"
            index={++n}
            title="Elevation & surfaces"
            description="Stepped surfaces defined by hairlines; shadows only on floating layers."
          >
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="surface-1 rounded-lg p-4">
                  <p className="text-overline text-muted-foreground">surface-1</p>
                  <p className="text-body-sm">Cards</p>
                </div>
                <div className="surface-2 rounded-lg p-4">
                  <p className="text-overline text-muted-foreground">surface-2</p>
                  <p className="text-body-sm">Tiles, popovers</p>
                </div>
                <div className="surface-3 rounded-lg p-4">
                  <p className="text-overline text-muted-foreground">surface-3</p>
                  <p className="text-body-sm">Dialogs, sheets</p>
                </div>
              </div>
              <div className="relative h-32 overflow-hidden rounded-lg border border-hairline">
                <div
                  className="absolute inset-0 space-y-1 p-3 text-sm text-muted-foreground"
                  aria-hidden="true"
                >
                  {Array.from({ length: 8 }, (_, i) => (
                    <p key={i}>
                      Scrolling text under the glass bar — Sporting Cristal 80% · FC Cajamarca 7%
                    </p>
                  ))}
                </div>
                <div className="glass absolute inset-x-0 top-6 px-4 py-3 text-sm">
                  .glass — blurred, readable
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                  <span className="text-caption text-faint">hairline</span>
                  <div className="h-10 w-24 rounded-md border border-hairline" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-caption text-faint">hairline-strong</span>
                  <div className="h-10 w-24 rounded-md border border-hairline-strong" />
                </div>
                {[8, 12, 16, 20, 24].map((r) => (
                  <div key={r} className="flex items-center gap-2">
                    <span className="text-caption text-faint">{r}px</span>
                    <div
                      className="h-10 w-10 border border-hairline-strong bg-surface-raised"
                      style={{ borderRadius: r }}
                    />
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <span className="text-caption text-faint">pill</span>
                  <div className="h-10 w-16 rounded-full border border-hairline-strong bg-surface-raised" />
                </div>
              </div>
            </div>
          </Section>

          <RuleChecker />
        </div>
      </div>
    </div>
  );
}
