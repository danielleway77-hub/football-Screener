import {
  DocumentUploadIllustration,
  FunnelIllustration,
  FunnelSearchIllustration,
  NotFoundIllustration,
  PlugPulseIllustration,
  RadarIllustration,
  SignalLostIllustration,
} from "@/components/illustrations";
import { Logo } from "@/components/shared/Logo";

const ILLUSTRATIONS = [
  ["Radar", "No data (automatic)", RadarIllustration],
  ["PlugPulse", "No data (helper)", PlugPulseIllustration],
  ["DocumentUpload", "No data (import)", DocumentUploadIllustration],
  ["Funnel", "None qualify", FunnelIllustration],
  ["FunnelSearch", "Filtered out", FunnelSearchIllustration],
  ["SignalLost", "Error / offline", SignalLostIllustration],
  ["NotFound", "404", NotFoundIllustration],
] as const;

/** Specimens for Step 3.5: logo on dark and on a busy background, icons, and all illustrations. */
export function BrandDemos() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h3 className="text-overline text-muted-foreground">Logo</h3>
        <div className="flex flex-wrap items-center gap-6">
          <div className="surface-1 flex max-w-full min-w-0 flex-wrap items-center gap-x-8 gap-y-4 rounded-lg p-5">
            {([20, 24, 28, 32] as const).map((s) => (
              <Logo key={s} size={s} />
            ))}
          </div>
          <div className="bg-grad-hero surface-1 flex max-w-full min-w-0 flex-wrap items-center gap-x-8 gap-y-4 rounded-lg p-5">
            <Logo size={32} />
            <Logo variant="glyph" size={32} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-overline text-muted-foreground">App icons (generated from icon.svg)</h3>
        <div className="flex flex-wrap items-end gap-6">
          {[32, 180, 192].map((s) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={s}
              src={s === 180 ? "/apple-icon.png" : `/icons/icon-${s}.png`}
              alt={`${s}px icon`}
              width={Math.min(s, 96)}
              height={Math.min(s, 96)}
              className="rounded-lg"
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-overline text-muted-foreground">Illustrations (160 and 80px)</h3>
        <div className="grid grid-cols-1 gap-6 min-[480px]:grid-cols-2 md:grid-cols-4">
          {ILLUSTRATIONS.map(([name, use, Component]) => (
            <figure
              key={name}
              className="min-w-0 space-y-2 text-faint"
              data-testid="illustration-card"
            >
              <Component size={160} className="h-auto max-w-full" />
              <Component size={80} />
              <figcaption className="text-caption text-muted-foreground">
                {name}
                <span className="block text-faint">{use}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
