"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClockIcon,
  DatabaseIcon,
  KeyRoundIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Callout } from "@/components/shared/Callout";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { HelperText } from "@/components/shared/HelperText";
import { RadioCards } from "@/components/shared/RadioCards";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { SlowHint } from "@/components/states/SlowHint";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/hooks/useHydrated";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSlowRequest } from "@/hooks/useSlowRequest";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { AppClientError, fetchJson } from "@/lib/fetcher";
import { SPRING, useMotionPrefs } from "@/lib/motion";
import { settingsFormSchema, type SettingsFormValues } from "@/lib/schemas/settings";
import { cn } from "@/lib/utils";
import { DualThresholdSlider } from "./DualThresholdSlider";
import { MaintenanceCard, type RescreenResult } from "./MaintenanceCard";
import { PasswordForm } from "./PasswordForm";
import { SectionNav, type SectionLink } from "./SectionNav";
import { TimezoneCombobox } from "./TimezoneCombobox";
import { ThresholdPreview, type FormPair } from "./ThresholdPreview";
import { TokenManager, type TokenRow } from "./TokenManager";

export type SettingsViewProps = {
  settings: SettingsFormValues & { runHourLocal: number };
  tokens: TokenRow[];
  storedCount: number;
  /** [home, away] form % of recent stored matches, for the live "would qualify" preview. */
  formPairs?: readonly FormPair[];
  officialApiConfigured: boolean;
};

type SaveResponse = {
  settings: SettingsFormValues & { runHourLocal: number };
  thresholdsChanged: boolean;
  windowChanged: boolean;
  rescreen: RescreenResult | null;
  rescreenSkipped: string | null;
};

const SECTIONS: SectionLink[] = [
  { id: "screening", label: "Screening" },
  { id: "schedule", label: "Schedule" },
  { id: "access", label: "Data access" },
  { id: "tokens", label: "Ingest tokens" },
  { id: "security", label: "Security" },
  { id: "maintenance", label: "Maintenance" },
];

const SECTION_ICONS: Record<string, LucideIcon> = {
  screening: SlidersHorizontalIcon,
  schedule: CalendarClockIcon,
  access: DatabaseIcon,
  tokens: KeyRoundIcon,
  security: ShieldCheckIcon,
  maintenance: WrenchIcon,
};

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const Icon = SECTION_ICONS[id] ?? SlidersHorizontalIcon;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <Card className="gap-5 px-4 transition-colors hover:border-hairline-strong md:px-6">
        <header className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-primary-border bg-primary-soft text-primary"
          >
            <Icon className="size-[18px]" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 id={`${id}-title`} className="text-h3">
              {title}
            </h2>
            <p className="text-body-sm text-muted-foreground">{description}</p>
          </div>
        </header>
        {children}
      </Card>
    </section>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 text-sm text-negative">
      {message}
    </p>
  );
}

/**
 * The Settings page body: six stacked sections. Screening, Schedule and Data access share ONE form with a
 * sticky save bar (visible only while there are unsaved edits). Saving changed thresholds re-screens the
 * stored matches on the server; the answer says how many changed. Leaving with unsaved edits asks first.
 */
export function SettingsView({
  settings,
  tokens,
  storedCount,
  formPairs = [],
  officialApiConfigured,
}: SettingsViewProps) {
  const router = useRouter();
  const online = useOnlineStatus();
  const hydrated = useHydrated();
  const { reduce } = useMotionPrefs();

  const toForm = React.useCallback(
    (s: SettingsFormValues): SettingsFormValues => ({
      highThreshold: s.highThreshold,
      lowThreshold: s.lowThreshold,
      windowDays: s.windowDays,
      formScope: s.formScope,
      timezone: s.timezone,
      accessMode: s.accessMode,
      staleAfterHrs: s.staleAfterHrs,
    }),
    [],
  );
  const [saved, setSaved] = React.useState<SettingsFormValues>(() => toForm(settings));
  const [rescreen, setRescreen] = React.useState<RescreenResult | null>(null);
  const [needsRescreen, setNeedsRescreen] = React.useState<string | null>(null);
  const [rescreening, setRescreening] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [justSaved, setJustSaved] = React.useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isDirty, isSubmitting, submitCount },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: saved,
    mode: "onChange",
  });
  const values = useWatch({ control }) as SettingsFormValues;
  const slow = useSlowRequest(isSubmitting);
  const guard = useUnsavedGuard(isDirty);
  const errorCount = Object.keys(errors).length;
  const changedCount = (Object.keys(saved) as (keyof SettingsFormValues)[]).filter(
    (k) => values[k] !== saved[k],
  ).length;

  React.useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 2600);
    return () => clearTimeout(t);
  }, [justSaved]);

  const onSubmit = handleSubmit(async (form) => {
    setSaveError(null);
    try {
      const result = await fetchJson<SaveResponse>("/api/settings", {
        method: "PUT",
        body: form,
      });
      const next = toForm(result.settings);
      setSaved(next);
      reset(next);
      toast.success("Settings saved.");
      setJustSaved(true);
      if (result.rescreen) {
        setRescreen(result.rescreen);
        setNeedsRescreen(null);
      } else if (result.thresholdsChanged) {
        setNeedsRescreen(result.rescreenSkipped ?? "Re-screen to apply to stored matches.");
      }
      router.refresh();
    } catch (error) {
      if (error instanceof AppClientError && error.fieldErrors) {
        for (const [key, messages] of Object.entries(error.fieldErrors)) {
          if (key in form)
            setError(key as keyof SettingsFormValues, { message: messages[0] ?? "" });
        }
      }
      const message =
        error instanceof AppClientError ? error.message : "We couldn't save. Try again.";
      setSaveError(message);
      toast.error(message);
    }
  });

  async function runRescreen() {
    const res = await fetchJson<RescreenResult & { total: number }>("/api/settings/rescreen", {
      method: "POST",
    });
    setRescreen({ changed: res.changed, qualifying: res.qualifying });
    setNeedsRescreen(null);
    toast.success(`${res.changed} changed · ${res.qualifying} now qualify.`);
    router.refresh();
  }

  async function rescreenFromHint() {
    setRescreening(true);
    try {
      await runRescreen();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't re-screen. Try again.");
    } finally {
      setRescreening(false);
    }
  }

  const accessOptions = [
    {
      value: "official_api" as const,
      title: "Automatic (official API)",
      description:
        "The app fetches the fixtures itself once a day. Needs an API from your data source.",
      tag: officialApiConfigured ? undefined : "Not configured",
    },
    {
      value: "assisted_ingest" as const,
      title: "One click a day (helper)",
      description:
        "A small browser helper sends what you can already see on the page. Needs the data source's written permission.",
      tag: "Not available yet",
    },
    {
      value: "manual_import" as const,
      title: "Paste or upload",
      description: "Paste text from a match page or upload a JSON or CSV file on the Import page.",
    },
  ];

  const barTransition = reduce ? { duration: 0 } : { ...SPRING, duration: 0.24 };

  return (
    <div
      data-testid="settings-view"
      data-hydrated={hydrated ? "true" : "false"}
      className="grid gap-8 lg:grid-cols-[220px_minmax(0,720px)]"
    >
      <SectionNav sections={SECTIONS} />

      <div className={cn("flex min-w-0 flex-col gap-4 md:gap-6", isDirty && "max-lg:pb-28")}>
        <form id="settings-form" onSubmit={onSubmit} noValidate className="contents">
          <Section
            id="screening"
            title="Screening"
            description="Which form values count as strong and poor, and how far ahead to look."
          >
            <div className="space-y-5">
              <DualThresholdSlider
                low={values.lowThreshold}
                high={values.highThreshold}
                lowError={errors.lowThreshold?.message}
                highError={errors.highThreshold?.message}
                onChange={({ low, high }) => {
                  const opts = { shouldDirty: true, shouldValidate: true } as const;
                  setValue("lowThreshold", low, opts);
                  setValue("highThreshold", high, opts);
                }}
              />

              <ThresholdPreview
                pairs={formPairs}
                low={values.lowThreshold}
                high={values.highThreshold}
                savedLow={saved.lowThreshold}
                savedHigh={saved.highThreshold}
                invalid={Boolean(errors.lowThreshold || errors.highThreshold)}
              />

              {needsRescreen ? (
                <Callout
                  tone="info"
                  data-testid="rescreen-hint"
                  action={
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={rescreening}
                      disabled={!online}
                      onClick={rescreenFromHint}
                    >
                      Re-screen now
                    </Button>
                  }
                >
                  Re-screen to apply to stored matches.
                </Callout>
              ) : rescreen ? (
                <Callout tone="positive" data-testid="save-rescreen-result">
                  Stored matches updated: <strong>{rescreen.changed}</strong> changed ·{" "}
                  <strong>{rescreen.qualifying}</strong> now qualify.
                </Callout>
              ) : null}

              <div>
                <p id="window-label" className="mb-2 text-sm font-medium">
                  Look ahead
                </p>
                <Controller
                  control={control}
                  name="windowDays"
                  render={({ field }) => (
                    <SegmentedControl
                      aria-label="Look ahead"
                      value={String(field.value) as "1" | "2"}
                      onChange={(v) => field.onChange(Number(v))}
                      options={[
                        { value: "1", label: "Tomorrow only" },
                        { value: "2", label: "Tomorrow + day after" },
                      ]}
                      className="w-full sm:w-auto [&_button]:h-auto [&_button]:px-3 [&_button]:py-1.5 [&_button]:leading-tight [&_button]:whitespace-normal"
                    />
                  )}
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Form scope</p>
                <Controller
                  control={control}
                  name="formScope"
                  render={({ field }) => (
                    <RadioCards
                      legend="Form scope"
                      name="formScope"
                      columns={2}
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        {
                          value: "league",
                          title: "League form",
                          description: "Form in the current league only.",
                        },
                        {
                          value: "overall",
                          title: "Overall form",
                          description: "Form across all competitions.",
                        },
                      ]}
                    />
                  )}
                />
                <p className="text-caption mt-2 text-faint">
                  Must match what your data source supplies — mismatched items are rejected.
                </p>
              </div>
            </div>
          </Section>

          <Section
            id="schedule"
            title="Schedule & timezone"
            description="When the daily check runs and which timezone times are shown in."
          >
            <div className="space-y-5">
              <div>
                <label htmlFor="timezone" className="mb-2 block text-sm font-medium">
                  Timezone
                </label>
                <Controller
                  control={control}
                  name="timezone"
                  render={({ field }) => (
                    <TimezoneCombobox
                      id="timezone"
                      value={field.value}
                      onChange={field.onChange}
                      invalid={Boolean(errors.timezone)}
                      describedBy={errors.timezone ? "timezone-error" : undefined}
                    />
                  )}
                />
                <FieldError id="timezone-error" message={errors.timezone?.message} />
              </div>
              <div>
                <label htmlFor="daily-time" className="mb-2 block text-sm font-medium">
                  Daily check time
                </label>
                <Input
                  id="daily-time"
                  value="06:00 UTC (≈ 06:00–07:00 UK)"
                  disabled
                  readOnly
                  aria-describedby="daily-time-help"
                />
                <HelperText id="daily-time-help">
                  Runs once a day on the free hosting plan.
                </HelperText>
              </div>
            </div>
          </Section>

          <Section id="access" title="Data access" description="How match data reaches the app.">
            <div className="space-y-5">
              <Controller
                control={control}
                name="accessMode"
                render={({ field }) => (
                  <RadioCards
                    legend="Data access"
                    name="accessMode"
                    value={field.value}
                    onChange={field.onChange}
                    options={accessOptions}
                  />
                )}
              />
              <div>
                <label htmlFor="stale-after" className="mb-2 block text-sm font-medium">
                  Mark data as stale after
                </label>
                <Controller
                  control={control}
                  name="staleAfterHrs"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Input
                        id="stale-after"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        value={Number.isNaN(field.value) ? "" : String(field.value)}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
                          field.onChange(digits === "" ? Number.NaN : Number(digits));
                        }}
                        onBlur={field.onBlur}
                        aria-invalid={errors.staleAfterHrs ? true : undefined}
                        aria-describedby={errors.staleAfterHrs ? "stale-error" : undefined}
                        className="num w-24 text-center"
                      />
                      <span className="text-muted-foreground">hours</span>
                    </div>
                  )}
                />
                <FieldError id="stale-error" message={errors.staleAfterHrs?.message} />
              </div>
            </div>
          </Section>
        </form>

        <Section
          id="tokens"
          title="Ingest tokens"
          description="Tokens let the helper send data to this app. Each one can be revoked."
        >
          <TokenManager initialTokens={tokens} timezone={saved.timezone} />
        </Section>

        <Section
          id="security"
          title="Security"
          description="Change the password. Other devices are signed out."
        >
          <PasswordForm />
        </Section>

        <Section
          id="maintenance"
          title="Maintenance"
          description="Tools for data that is already stored."
        >
          <MaintenanceCard
            storedCount={storedCount}
            high={saved.highThreshold}
            low={saved.lowThreshold}
            result={rescreen}
            unsaved={
              values.highThreshold !== saved.highThreshold ||
              values.lowThreshold !== saved.lowThreshold
            }
            onRescreen={runRescreen}
          />
        </Section>

        <AnimatePresence>
          {justSaved && !isDirty ? (
            <motion.div
              key="saved-chip"
              data-testid="saved-chip"
              role="status"
              initial={reduce ? false : { y: 12, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={barTransition}
              className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[var(--z-popover)] flex h-11 items-center gap-2 rounded-full border border-positive/40 bg-surface-overlay pr-4 pl-2 text-sm font-medium shadow-lg lg:sticky lg:right-auto lg:bottom-4 lg:self-end"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-positive-soft text-positive">
                <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
                  <motion.path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                  />
                </svg>
              </span>
              All changes saved
            </motion.div>
          ) : null}
          {isDirty ? (
            <motion.div
              key="save-bar"
              data-testid="save-bar"
              initial={reduce ? false : { y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { y: 8, opacity: 0 }}
              transition={barTransition}
              className={cn(
                "z-[var(--z-popover)] border-hairline-strong bg-surface-overlay",
                // < 1024: fixed to the viewport bottom, safe-area aware. >= 1024: sticky inside the column.
                "fixed inset-x-0 bottom-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
                "lg:sticky lg:inset-x-auto lg:bottom-4 lg:rounded-lg lg:border lg:p-3 lg:pl-5 lg:shadow-lg",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:min-h-10 lg:flex-nowrap">
                <div className="min-w-0 flex-1 basis-40" aria-live="polite">
                  <p
                    className={cn(
                      "flex items-center gap-2 text-sm font-medium",
                      (saveError || (errorCount > 0 && submitCount > 0)) && "text-negative",
                    )}
                  >
                    {saveError || (errorCount > 0 && submitCount > 0) ? null : (
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full bg-primary motion-safe:animate-pulse"
                      />
                    )}
                    {errorCount > 0 && submitCount > 0
                      ? `Fix ${errorCount} ${errorCount === 1 ? "field" : "fields"} to save.`
                      : saveError
                        ? saveError
                        : "You have unsaved changes"}
                    {changedCount > 0 && !saveError ? (
                      <span className="num text-caption rounded-full bg-neutral-soft px-2 py-0.5 text-muted-foreground">
                        {changedCount}
                      </span>
                    ) : null}
                  </p>
                  {online ? null : (
                    <HelperText className="mt-0.5">
                      You&apos;re offline. Reconnect to save.
                    </HelperText>
                  )}
                  <SlowHint active={slow} className="mt-0.5" />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      reset(saved);
                      setSaveError(null);
                    }}
                    disabled={isSubmitting}
                  >
                    Discard
                  </Button>
                  <Button
                    type="submit"
                    form="settings-form"
                    loading={isSubmitting}
                    disabled={!online}
                  >
                    Save changes
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <ConfirmDialog
        open={guard.leaveOpen}
        onOpenChange={(open) => {
          if (!open) guard.stay();
        }}
        title="Leave without saving?"
        description="Your changes to the settings have not been saved."
        confirmLabel="Leave"
        cancelLabel="Keep editing"
        onConfirm={guard.confirmLeave}
      />
    </div>
  );
}
