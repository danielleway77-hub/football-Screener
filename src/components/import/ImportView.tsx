"use client";

import * as React from "react";
import Link from "next/link";
import { Callout } from "@/components/shared/Callout";
import { HelperText } from "@/components/shared/HelperText";
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
import { cn } from "@/lib/utils";
import { parsePageText } from "@/server/domain/parse-page-text";
import { DropZone } from "./DropZone";
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

function ResultCard({ outcome, onAgain }: { outcome: Outcome; onAgain: () => void }) {
  const imported = Math.max(0, outcome.scanned - outcome.failed);
  const partial = outcome.failed > 0;
  return (
    <div className="space-y-4" data-testid="import-result">
      {outcome.none ? (
        <Callout tone="negative" title="None of the matches could be imported.">
          Fix the rows below and try again. Nothing was changed.
        </Callout>
      ) : partial ? (
        <Callout tone="warning">
          <strong data-testid="result-imported">{imported}</strong> imported,{" "}
          <strong data-testid="result-skipped">{outcome.failed}</strong> skipped. See reasons below.
        </Callout>
      ) : (
        <Callout tone="positive">
          Imported <strong data-testid="result-imported">{imported}</strong> matches ·{" "}
          <strong data-testid="result-qualified">{outcome.qualified}</strong> qualify.
        </Callout>
      )}
      {outcome.reasons.length > 0 ? (
        <ul className="space-y-2 text-sm" data-testid="result-reasons">
          {outcome.reasons.map((r) => (
            <li key={`${r.label}-${r.reason}`} className="flex gap-3">
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
    </div>
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
      setInputError(TOO_LARGE);
      return;
    }
    setFileText(await file.text());
  }

  function onFileTextChange(value: string) {
    setOutcome(null);
    if (new Blob([value]).size > MAX_BYTES) {
      setInputError(TOO_LARGE.replace("file", "paste"));
      return;
    }
    setInputError(null);
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

  const recommended = accessMode === "assisted_ingest" ? "helper" : "paste";
  const chip = (
    <span className="rounded-4xl border border-primary-border bg-primary-soft px-2 py-0.5 text-[0.6875rem] font-bold tracking-[0.06em] text-primary uppercase">
      Recommended
    </span>
  );

  return (
    <div
      data-testid="import-view"
      data-hydrated={hydrated ? "true" : "false"}
      className="max-w-[880px]"
    >
      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <TabsList className="h-auto w-full p-1 sm:w-fit">
          <TabsTrigger value="helper" className="h-11 flex-1 gap-2 px-4 sm:flex-none">
            Assisted helper {recommended === "helper" ? chip : null}
          </TabsTrigger>
          <TabsTrigger value="paste" className="h-11 flex-1 gap-2 px-4 sm:flex-none">
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
                className="w-full sm:w-auto"
              />

              {source === "file" ? (
                <div className="space-y-4">
                  <DropZone
                    disabled={submitting}
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
                        className="inline-flex min-h-6 items-center text-sm text-primary underline-offset-2 hover:underline"
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
                    <p className="text-caption mt-2 text-faint">
                      JSON or CSV. Percentages like 80, 80% or 80,5% are fine. Times need a zone
                      (for example 2026-11-08T19:00:00Z).
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
                <section
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
                </section>
              ) : null}

              {submitError ? (
                <Callout tone="negative" data-testid="submit-error">
                  {submitError}
                </Callout>
              ) : null}

              <div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    size="lg"
                    loading={submitting}
                    disabled={!canSubmit}
                    onClick={submit}
                    className="max-sm:w-full"
                  >
                    Import {preview?.counts.valid ?? 0} matches
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    onClick={reset}
                    disabled={submitting || (!fileText && !pageText)}
                    className="max-sm:w-full"
                  >
                    Clear
                  </Button>
                </div>
                {online ? null : <HelperText>You&apos;re offline. Reconnect to import.</HelperText>}
                <SlowHint active={slow} />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
