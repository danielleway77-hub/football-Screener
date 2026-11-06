import { AlertTriangleIcon, CheckCircle2Icon, InfoIcon, XCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalloutTone = "info" | "warning" | "positive" | "negative";

const TONES: Record<CalloutTone, { cls: string; icon: typeof InfoIcon }> = {
  info: { cls: "border-info/30 bg-info-soft [&>svg]:text-info", icon: InfoIcon },
  warning: {
    cls: "border-warning/40 bg-warning-soft [&>svg]:text-warning",
    icon: AlertTriangleIcon,
  },
  positive: {
    cls: "border-positive/40 bg-positive-soft [&>svg]:text-positive",
    icon: CheckCircle2Icon,
  },
  negative: { cls: "border-negative/40 bg-negative-soft [&>svg]:text-negative", icon: XCircleIcon },
};

type CalloutProps = {
  tone?: CalloutTone;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"div">, "title">;

/** Inline status box (icon + text + optional action). Negative = role alert, others = role status. */
export function Callout({
  tone = "info",
  title,
  children,
  action,
  className,
  ...props
}: CalloutProps) {
  const { cls, icon: Icon } = TONES[tone];
  return (
    <div
      role={tone === "negative" ? "alert" : "status"}
      data-tone={tone}
      className={cn("flex items-start gap-3 rounded-md border p-3 text-sm", cls, className)}
      {...props}
    >
      <Icon className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? (
          <div className="text-muted-foreground [&_strong]:text-foreground">{children}</div>
        ) : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
