"use client";

import * as React from "react";
import Link from "next/link";
import { animate, motion } from "framer-motion";
import { WifiOffIcon, XCircleIcon } from "lucide-react";
import { Callout } from "@/components/shared/Callout";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { SlowHint } from "@/components/states/SlowHint";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/hooks/useHydrated";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSlowRequest } from "@/hooks/useSlowRequest";
import { AppClientError, fetchJson } from "@/lib/fetcher";
import {
  buildPreview,
  draftFromParsed,
  itemFromDraft,
  previewItems,
  type ImportContext,
  type Preview,
  type TextDraft,
} from "@/lib/import/model";
import {
  buildSampleCsv,
  buildSampleJson,
  downloadText,
  SAMPLE_PLACEHOLDER,
} from "@/lib/import/samples";
import { DURATION, EASE_OUT, useMotionPrefs } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { parsePageText } from "@/server/domain/parse-page-text";
import { DropZone } from "./DropZone";
import { ImportStepper } from "./ImportStepper";
import { CountChips, PreviewList } from "./PreviewList";
import { TextMatches } from "./TextMatches";

const MAX_BYTES = 1024 * 1024;
const TOO_LARGE = "That file is too large (max 1 MB).";

export type ImportViewProps = {
  accessMode: "official_api" | "assisted_ingest" | "manual_import";
  formScope: "league" | "overall";
  high: number;
  low: number;
  timezone: string;
  /** Pre-formatted status line of the latest helper update, or null when none arrived yet. */
  lastIngest: string | null;
};

type Reason = { label: string; reason: string };
type Outcome = {
  scanned: number;
  qualified: number;
  failed: number;
  reasons: Reason[];
  /** True when nothing could be imported (HTTP 422). */
  none: boolean;
};

type ApiOk = {
  scanned: number;
  qualified: number;
  failed: number;
  reasons?: { index: number; reason: string }[];
};

const scopeName = (s: "league" | "overall") => (s === "league" ? "League" : "Overall");

/** Counts up to `value` once on mount (text is the final value for SSR, reduced motion and tests). */
function CountNumber({ value, testId }: { value: number; testId: string }) {
  const { reduce } = useMotionPrefs();
  const ref = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (reduce || !el || value < 2) return;
    const controls = animate(0, value, {
      duration: DURATION.countUp,
      ease: EASE_OUT,
      onUpdate: (v) => {
        el.textContent = String(Math.round(v));
      },
    });
    return () => {
      controls.stop();
      el.textContent = String(value);
    };
  }, [value, reduce]);
  return (
    <strong ref={ref} data-testid={testId} className="num">
      {value}
    </strong>
  );
}

/** Ring + check that draws itself (static under reduced motion). */
function ResultMark({ tone }: { tone: "positive" | "warning" | "negative" }) {
  const { reduce } = useMotionPrefs();
  const color =
    tone === "positive" ? "text-positive" : tone === "warning" ? "text-warning" : "text-negative";
  const draw = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { pathLength: 0 },
          animate: { pathLength: 1 },
          transition: { duration: 0.5, ease: EASE_OUT, delay },
        };
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("size-14 shrink-0", color)}
      fill="none"
      aria-hidden="true"
    >
      <motion.circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2" {...draw(0)} />
      {tone === "positive" ? (
        <motion.path
          d="M15 25l6 6 12-13"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...draw(0.3)}
        />
      ) : (
        <motion.path
          d={tone === "warning" ? "M24 14v12M24 33v1" : "M17 17l14 14M31 17L17 31"}
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          {...draw(0.3)}
        />
      )}
    </svg>
  );
}

function ResultCard({ outcome, onAgain }: { outcome: Outcome; onAgain: () => void }) {
  const { reduce } = useMotionPrefs();
  const imported = Math.max(0, outcome.scanned - outcome.failed);
  const partial = outcome.failed > 0;
  const tone = outcome.none ? "negative" : partial ? "warning" : "positive";
  return (
    <motion.div
      className="space-y-5 rounded-xl border border-hairline bg-surface-raised p-5 sm:p-6"
      data-testid="import-result"
      data-tone={tone}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.page, ease: EASE_OUT }}
    >
      <div className="flex items-center gap-4" role={outcome.none ? "alert" : "status"}>
        <ResultMark tone={tone} />
        <div className="min-w-0 space-y-1">
          {outcome.none ? (
            <>
              <p className="text-h3">None of the matches could be imported.</p>
              <p className="text-body-sm text-muted-foreground">
                Fix the rows below and try again. Nothing was changed.
              </p>
            </>
          ) : partial ? (
            <>
              <p className="text-h3">
                <CountNumber value={imported} testId="result-imported" /> imported,{" "}
                <CountNumber value={outcome.failed} testId="result-skipped" /> skipped. See reasons
                below.
              </p>
              <p className="text-body-sm text-muted-foreground">
                The valid matches are saved. Fix the skipped ones and import them again.
              </p>
            </>
          ) : (
            <>
              <p className="text-h3">
                Imported <CountNumber value={imported} testId="result-imported" /> matches ·{" "}
                <CountNumber value={outcome.qualified} testId="result-qualified" /> qualify.
              </p>
              <p className="text-body-sm text-muted-foreground">
                Your dashboard is up to date with this data.
              </p>
            </>
          )}
        </div>
      </div>
      {outcome.reasons.length > 0 ? (
        <ul className="space-y-2 text-sm" data-testid="result-reasons">
          {outcome.reasons.map((r) => (
            <li
              key={`${r.label}-${r.reason}`}
              className="flex items-start gap-3 rounded-md border border-negative/30 bg-negative-soft/40 px-3 py-2"
            >
              <XCircleIcon className="mt-0.5 size-4 shrink-0 text-negative" aria-hidden="true" />
              <span className="num w-16 shrink-0 text-muted-foreground">{r.label}</span>
              <span className="text-negative">{r.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        {outcome.none ? null : (
          <Link href="/" className={cn(buttonVariants(), "max-sm:w-full")}>
            View dashboard
          </Link>
        )}
        <Button type="button" variant="ghost" onClick={onAgain} className="max-sm:w-full">
          Import another
        </Button>
      </div>
    </motion.div>
  );
}

function HelperTab({
  formScope,
  lastIngest,
  onUsePaste,
}: {
  formScope: "league" | "overall";
  lastIngest: string | null;
  onUsePaste: () => void;
}) {
  return (
    <div className="space-y-4">
      <Callout tone="info" title="The one-click helper is not available yet.">
        It needs written permission from the data source before it can be built. Until then, use{" "}
        <button
          type="button"
          onClick={onUsePaste}
          className="font-semibold text-primary underline-offset-2 hover:underline"
        >
          Paste / upload
        </button>
        : it takes about a minute and you still open the matches yourself.
      </Callout>
      <Callout tone="info" data-testid="scope-reminder">
        On the source page select <strong>{scopeName(formScope)} form</strong> before you copy
        anything. This follows your Settings.
      </Callout>
      <div className="rounded-md border border-hairline p-4">
        <p className="text-body-sm text-muted-foreground" data-testid="last-ingest">
          {lastIngest ?? "No updates received yet."}
        </p>
        <p className="text-caption mt-2 text-faint">
          If a helper is ever added, it uses a token from{" "}
          <Link href="/settings#tokens" className="text-primary underline-offset-2 hover:underline">
            Settings
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/**
 * The Import page body. Tabs: Assisted helper | Paste / upload. Paste / upload has two sources that end in
 * the same preview and the same POST /api/import: a data file (JSON/CSV, checked on the client with the
 * server's own validation) and "Page text" (smart paste: text the owner copied herself). Nothing here
 * reads any other website.
 */
export function ImportView({
  accessMode,
  formScope,
  high,
  low,
  timezone,
  lastIngest,
}: ImportViewProps) {
  const hydrated = useHydrated();
  const online = useOnlineStatus();
  const ctx = React.useMemo<ImportContext>(
    () => ({ high, low, formScope }),
    [high, low, formScope],
  );

  const [tab, setTab] = React.useState(accessMode === "assisted_ingest" ? "helper" : "paste");
  const [source, setSource] = React.useState<"file" | "text">("file");
  const [fileText, setFileText] = React.useState("");
  const [pageText, setPageText] = React.useState("");
  const [edits, setEdits] = React.useState<Record<number, Partial<TextDraft>>>({});
  const [inputError, setInputError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [reading, setReading] = React.useState(false);
  const [loadedFile, setLoadedFile] = React.useState<{ name: string; size: number } | null>(null);
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);
  const inFlight = React.useRef(false);
  const slow = useSlowRequest(submitting);

  const deferredFile = React.useDeferredValue(fileText);
  const deferredPage = React.useDeferredValue(pageText);

  const filePreview = React.useMemo<Preview | null>(
    () => (deferredFile.trim() ? buildPreview(deferredFile, ctx) : null),
    [deferredFile, ctx],
  );

  const parsed = React.useMemo(
    () => (deferredPage.trim() ? parsePageText(deferredPage) : null),
    [deferredPage],
  );
  const drafts = React.useMemo<TextDraft[]>(
    () =>
      (parsed?.matches ?? []).map((m, i) => ({
        ...draftFromParsed(m, timezone),
        ...edits[i],
      })),
    [parsed, edits, timezone],
  );
  const textPreview = React.useMemo<Preview | null>(() => {
    if (!parsed) return null;
    if (drafts.length === 0) return null;
    return previewItems(
      drafts.map((d) => itemFromDraft(d, timezone, ctx)),
      drafts.map((_, i) => `Match ${i + 1}`),
      ctx,
    );
  }, [parsed, drafts, ctx, timezone]);

  const preview = source === "file" ? filePreview : textPreview;
  const canSubmit =
    online && !submitting && preview !== null && preview.error === null && preview.counts.valid > 0;

  function reset() {
    setFileText("");
    setPageText("");
    setLoadedFile(null);
    setEdits({});
    setInputError(null);
    setSubmitError(null);
    setOutcome(null);
  }

  async function readFile(file: File) {
    setInputError(null);
    setOutcome(null);
    if (file.size > MAX_BYTES) {
      setFileText("");
      setLoadedFile(null);
      setInputError(TOO_LARGE);
      return;
    }
    setReading(true);
    try {
      const text = await file.text();
      setFileText(text);
      setLoadedFile({ name: file.name, size: file.size });
    } catch {
      setLoadedFile(null);
      setInputError("We couldn't read that file. Try another one.");
    } finally {
      setReading(false);
    }
  }

  function onFileTextChange(value: string) {
    setOutcome(null);
    if (new Blob([value]).size > MAX_BYTES) {
      setInputError(TOO_LARGE.replace("file", "paste"));
      return;
    }
    setInputError(null);
    setLoadedFile(null);
    setFileText(value);
  }

  async function submit() {
    if (inFlight.current || !preview?.payload) return;
    inFlight.current = true; // double-click guard: one request per submit
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (new Blob([JSON.stringify(preview.payload)]).size > MAX_BYTES) {
        setSubmitError(TOO_LARGE.replace("file", "import"));
        return;
      }
      const labels = preview.labels;
      const label = (i: number) => labels[i] ?? `Item ${i + 1}`;
      try {
        const res = await fetchJson<ApiOk>("/api/import", {
          method: "POST",
          body: preview.payload,
          timeoutMs: 60_000,
        });
        setOutcome({
          scanned: res.scanned,
          qualified: res.qualified,
          failed: res.failed,
          reasons: (res.reasons ?? []).map((r) => ({ label: label(r.index), reason: r.reason })),
          none: false,
        });
      } catch (error) {
        if (error instanceof AppClientError && error.status === 422) {
          const body = error.body as {
            reasons?: { index: number; reason: string }[];
            scanned?: number;
            failed?: number;
          };
          if (body?.reasons?.length) {
            setOutcome({
              scanned: body.scanned ?? body.reasons.length,
              qualified: 0,
              failed: body.failed ?? body.reasons.length,
              reasons: body.reasons.map((r) => ({ label: label(r.index), reason: r.reason })),
              none: true,
            });
            return;
          }
        }
        setSubmitError(
          error instanceof AppClientError
            ? error.code === "RUN_IN_PROGRESS"
              ? "Another update is running. Try again in a minute."
              : error.code === "RATE_LIMITED"
                ? `Too many attempts. Try again in ${Math.max(1, Math.ceil((error.retryAfterSeconds ?? 60) / 60))} minutes.`
                : error.message
            : "We couldn't import. Try again.",
        );
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  const step: 0 | 1 | 2 | 3 = outcome ? 3 : canSubmit || submitting ? 2 : preview ? 1 : 0;
  const pasteBytes = new Blob([fileText]).size;
  const recommended = accessMode === "assisted_ingest" ? "helper" : "paste";
  const chip = (
    <span className="rounded-4xl border border-primary-border bg-primary-soft px-2 py-0.5 text-xs font-bold tracking-[0.06em] text-primary uppercase">
      Recommended
    </span>
  );

  return (
    <div
      data-testid="import-view"
      data-hydrated={hydrated ? "true" : "false"}
      className="mx-auto w-full max-w-[880px]"
    >
      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <TabsList className="grid h-auto w-full grid-cols-2 p-1 md:inline-flex md:w-fit">
          <TabsTrigger
            value="helper"
            className="min-h-11 flex-1 flex-col gap-1 px-3 py-1.5 md:flex-none md:flex-row md:gap-2 md:px-4"
          >
            Assisted helper {recommended === "helper" ? chip : null}
          </TabsTrigger>
          <TabsTrigger
            value="paste"
            className="min-h-11 flex-1 flex-col gap-1 px-3 py-1.5 md:flex-none md:flex-row md:gap-2 md:px-4"
          >
            Paste / upload {recommended === "paste" ? chip : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="helper">
          <HelperTab
            formScope={formScope}
            lastIngest={lastIngest}
            onUsePaste={() => setTab("paste")}
          />
        </TabsContent>

        <TabsContent value="paste" className="space-y-6">
          <ImportStepper current={step} />
          {outcome ? (
            <ResultCard outcome={outcome} onAgain={reset} />
          ) : (
            <>
              <SegmentedControl
                aria-label="What are you importing?"
                value={source}
                onChange={(v) => {
                  setSource(v);
                  setInputError(null);
                  setSubmitError(null);
                }}
                options={[
                  { value: "file", label: "Data file" },
                  { value: "text", label: "Page text" },
                ]}
                className="w-full sm:w-auto [&_button]:h-11"
              />

              {source === "file" ? (
                <div className="space-y-4">
                  <DropZone
                    disabled={submitting}
                    reading={reading}
                    loaded={loadedFile}
                    onFile={readFile}
                    onSampleJson={() =>
                      downloadText(
                        "matches-sample.json",
                        "application/json",
                        buildSampleJson(new Date()),
                      )
                    }
                    onSampleCsv={() =>
                      downloadText("matches-sample.csv", "text/csv", buildSampleCsv(new Date()))
                    }
                  />
                  {inputError ? (
                    <Callout tone="negative" data-testid="input-error">
                      {inputError}
                    </Callout>
                  ) : null}
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="paste-data" className="text-sm font-medium">
                        or paste data
                      </label>
                      <button
                        type="button"
                        onClick={() => onFileTextChange(buildSampleJson(new Date()))}
                        className="inline-flex min-h-11 items-center rounded-md px-2 text-sm text-primary underline-offset-2 hover:underline"
                      >
                        Use sample JSON
                      </button>
                    </div>
                    <Textarea
                      id="paste-data"
                      rows={8}
                      value={fileText}
                      onChange={(e) => onFileTextChange(e.target.value)}
                      placeholder={SAMPLE_PLACEHOLDER}
                      spellCheck={false}
                      disabled={submitting}
                      className="num field-sizing-fixed font-mono text-[13px]"
                    />
                    <p className="text-caption mt-2 flex flex-wrap justify-between gap-x-4 text-faint">
                      <span>
                        JSON or CSV. Percentages like 80, 80% or 80,5% are fine. Times need a zone
                        (for example 2026-11-08T19:00:00Z).
                      </span>
                      {fileText ? (
                        <span className="num" data-testid="paste-size">
                          {(pasteBytes / 1024).toFixed(1)} KB of 1024 KB
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Callout tone="info" data-testid="smart-paste-note">
                    This saves typing and screening, but you still open the matches yourself. Open a
                    match page, select all (Ctrl+A), copy (Ctrl+C) and paste here. Up to 20 matches,
                    one after another. Use <strong>{scopeName(formScope)} form</strong> on the
                    source page.
                  </Callout>
                  <div>
                    <label htmlFor="paste-page" className="mb-2 block text-sm font-medium">
                      Paste text from a match page
                    </label>
                    <Textarea
                      id="paste-page"
                      rows={8}
                      value={pageText}
                      onChange={(e) => {
                        if (new Blob([e.target.value]).size > MAX_BYTES) {
                          setInputError("That paste is too large (max 1 MB).");
                          return;
                        }
                        setInputError(null);
                        setPageText(e.target.value);
                        setEdits({});
                        setOutcome(null);
                      }}
                      placeholder="Select all on a match page, copy, and paste here…"
                      spellCheck={false}
                      disabled={submitting}
                      className="field-sizing-fixed text-[13px]"
                    />
                  </div>
                  {inputError && source === "text" ? (
                    <Callout tone="negative">{inputError}</Callout>
                  ) : null}
                  {parsed && parsed.problems.length > 0 ? (
                    <Callout
                      tone="warning"
                      title="Some values could not be read"
                      data-testid="parse-problems"
                    >
                      <ul className="list-disc space-y-0.5 pl-5">
                        {parsed.problems.slice(0, 6).map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </Callout>
                  ) : null}
                  {drafts.length > 0 && textPreview ? (
                    <TextMatches
                      drafts={drafts}
                      rows={textPreview.rows}
                      timezone={timezone}
                      onEdit={(i, patch) => setEdits((e) => ({ ...e, [i]: { ...e[i], ...patch } }))}
                    />
                  ) : null}
                </div>
              )}

              {preview?.error ? (
                <Callout tone="negative" title="We couldn't read that." data-testid="parse-error">
                  {preview.error}
                </Callout>
              ) : null}

              {preview && !preview.error ? (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DURATION.page, ease: EASE_OUT }}
                  aria-labelledby="preview-title"
                  className="space-y-4"
                  data-testid="preview"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id="preview-title" className="text-h3">
                      Preview
                    </h2>
                    <CountChips {...preview.counts} />
                  </div>
                  {preview.notes.map((n) => (
                    <p key={n} className="text-caption text-faint">
                      {n}
                    </p>
                  ))}
                  {source === "file" ? <PreviewList rows={preview.rows} /> : null}
                  {preview.counts.valid === 0 ? (
                    <Callout tone="negative">
                      No valid matches yet. Fix the problems above to import.
                    </Callout>
                  ) : null}
                </motion.section>
              ) : null}

              {submitError ? (
                <Callout tone="negative" data-testid="submit-error">
                  {submitError}
                </Callout>
              ) : null}

              <div
                data-testid="action-bar"
                className={cn(
                  preview && !preview.error && "sticky bottom-3 z-10",
                  "space-y-2 rounded-xl border border-hairline-strong bg-surface-raised/90 p-3 shadow-lg backdrop-blur-md",
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <p
                    className="text-body-sm min-w-0 flex-1 text-muted-foreground"
                    aria-live="polite"
                    data-testid="action-summary"
                  >
                    {preview && !preview.error ? (
                      <>
                        <motion.strong
                          key={preview.counts.valid}
                          className="num inline-block text-foreground"
                          initial={{ y: 6, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ duration: DURATION.ui, ease: EASE_OUT }}
                        >
                          {preview.counts.valid}
                        </motion.strong>{" "}
                        ready to import
                        {preview.counts.invalid > 0 ? (
                          <span className="text-negative">
                            {" "}
                            · {preview.counts.invalid} need fixing
                          </span>
                        ) : null}
                      </>
                    ) : (
                      "Add data above to see a preview."
                    )}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      onClick={reset}
                      disabled={submitting || (!fileText && !pageText)}
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      loading={submitting}
                      disabled={!canSubmit}
                      onClick={submit}
                      className="max-sm:flex-1"
                    >
                      Import {preview?.counts.valid ?? 0} matches
                    </Button>
                  </div>
                </div>
                {online ? null : (
                  <p
                    className="text-body-sm flex items-center gap-2 text-warning"
                    data-testid="offline-note"
                  >
                    <WifiOffIcon className="size-4 shrink-0" aria-hidden="true" />
                    You&apos;re offline. Reconnect to import.
                  </p>
                )}
                <SlowHint active={slow} />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
