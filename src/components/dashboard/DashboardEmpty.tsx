import { EmptyState } from "@/components/states/EmptyState";
import { Reveal } from "@/components/motion/Reveal";

type DashboardEmptyProps = React.ComponentProps<typeof EmptyState>;

/**
 * The dashboard's empty views (no data yet / none qualify / filtered out) on one soft surface with a
 * faint lime wash and a gentle reveal. The reveal is skipped for the server-rendered first paint, so
 * the SSR output is the final state and nothing shifts.
 */
export function DashboardEmpty(props: DashboardEmptyProps) {
  return (
    <Reveal>
      <div
        data-testid="dashboard-empty"
        className="surface-1 rounded-lg bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_6%,transparent),transparent_65%)] py-4 md:py-8"
      >
        <EmptyState {...props} />
      </div>
    </Reveal>
  );
}

/** Small read-only chip used under an empty state's description. */
export function HintChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-4xl border border-hairline-strong bg-surface-raised px-2.5 text-xs whitespace-nowrap">
      <span className="text-muted-foreground">{label}</span>
      <span className="num text-foreground">{value}</span>
    </span>
  );
}
