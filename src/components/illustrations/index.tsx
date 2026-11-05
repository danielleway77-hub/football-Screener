import { Illustration, drawProps, type IllustrationProps } from "./Illustration";

export type { IllustrationProps };

const ACCENT = "var(--primary)";
const NEGATIVE = "var(--negative)";
const WASH = "var(--primary-soft)"; // the 8–12% lime wash

/** No data yet (automatic mode): radar with a lime sweep. */
export function RadarIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <circle cx="80" cy="64" r="18" />
      <circle cx="80" cy="64" r="36" />
      <circle cx="80" cy="64" r="54" />
      <path d="M80 64 L80 10 A54 54 0 0 1 126.8 37 Z" fill={WASH} stroke={ACCENT} {...drawProps} />
      <circle cx="80" cy="64" r="3" fill={ACCENT} stroke="none" />
      <circle cx="104" cy="46" r="2" fill="currentColor" stroke="none" />
      <circle cx="58" cy="84" r="2" fill="currentColor" stroke="none" />
    </Illustration>
  );
}

/** No data yet (helper mode): a plug connected to a heartbeat line. */
export function PlugPulseIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <rect x="18" y="46" width="36" height="28" rx="6" />
      <path d="M28 46 V34 M44 46 V34" />
      <path d="M54 60 H70" />
      <polyline
        points="70,60 84,60 90,44 98,80 106,52 112,60 142,60"
        stroke={ACCENT}
        {...drawProps}
      />
    </Illustration>
  );
}

/** No data yet (manual import): a document with a rising arrow. */
export function DocumentUploadIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <path d="M60 20 H92 L108 36 V92 a8 8 0 0 1 -8 8 H60 a8 8 0 0 1 -8 -8 V28 a8 8 0 0 1 8 -8 Z" />
      <path d="M92 20 V36 H108" />
      <path d="M62 52 H98 M62 64 H98 M62 76 H84" />
      <path d="M80 112 V90 M71 99 L80 90 L89 99" stroke={ACCENT} {...drawProps} />
    </Illustration>
  );
}

/** Nothing qualifies: everything is filtered out. */
export function FunnelIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <path d="M40 32 H120 L88 68 V88 H72 V68 Z" />
      <circle cx="58" cy="16" r="3" />
      <circle cx="72" cy="22" r="3" />
      <circle cx="86" cy="14" r="3" />
      <circle cx="100" cy="22" r="3" />
      <circle cx="114" cy="14" r="3" />
      <path d="M72 96 H88" stroke={ACCENT} {...drawProps} />
    </Illustration>
  );
}

/** Filters exclude everything: funnel plus magnifier. */
export function FunnelSearchIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <path d="M24 32 H96 L68 66 V86 H52 V66 Z" />
      <circle cx="108" cy="72" r="14" stroke={ACCENT} {...drawProps} />
      <path d="M118 82 L132 98" stroke={ACCENT} {...drawProps} />
    </Illustration>
  );
}

/** Error / offline: signal arcs with a broken middle arc and a small cross. */
export function SignalLostIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <path d="M65.9 81.9 A20 20 0 0 1 94.1 81.9" />
      <path d="M53.1 69.1 A38 38 0 0 1 70.2 59.3 M89.8 59.3 A38 38 0 0 1 106.9 69.1" />
      <path d="M40.4 56.4 A56 56 0 0 1 119.6 56.4" />
      <circle cx="80" cy="96" r="3" fill="currentColor" stroke="none" />
      <path d="M75 57 L85 67 M85 57 L75 67" stroke={NEGATIVE} />
    </Illustration>
  );
}

/** 404: pitch centre circle with a question mark. */
export function NotFoundIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <circle cx="80" cy="60" r="40" />
      <path d="M80 14 V106" strokeOpacity="0.4" />
      <path d="M71 50 a9 9 0 1 1 13 8 c-3 2 -4 4 -4 8" stroke={ACCENT} {...drawProps} />
      <circle cx="80" cy="76" r="2" fill={ACCENT} stroke="none" />
    </Illustration>
  );
}

export type IllustrationVariant =
  | "no-data-api"
  | "no-data-helper"
  | "no-data-import"
  | "none-qualify"
  | "filtered-out"
  | "error"
  | "offline"
  | "not-found";

const MAP = {
  "no-data-api": RadarIllustration,
  "no-data-helper": PlugPulseIllustration,
  "no-data-import": DocumentUploadIllustration,
  "none-qualify": FunnelIllustration,
  "filtered-out": FunnelSearchIllustration,
  error: SignalLostIllustration,
  offline: SignalLostIllustration,
  "not-found": NotFoundIllustration,
} as const;

/** The illustration for an empty/error variant (UI_BLUEPRINT §4.4). */
export function illustrationFor(variant: IllustrationVariant, props?: IllustrationProps) {
  const Component = MAP[variant];
  return <Component {...props} />;
}
