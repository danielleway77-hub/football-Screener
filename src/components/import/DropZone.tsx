"use client";

import * as React from "react";
import { CheckCircle2Icon, FileTextIcon, Loader2Icon, UploadCloudIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { SPRING, useMotionPrefs } from "@/lib/motion";
import { cn } from "@/lib/utils";

type DropZoneProps = {
  onFile: (file: File) => void;
  onSampleJson: () => void;
  onSampleCsv: () => void;
  disabled?: boolean;
  /** True while a chosen file is being read. */
  reading?: boolean;
  /** The file that is loaded right now (name + bytes), when the data came from a file. */
  loaded?: { name: string; size: number } | null;
};

const sampleLink =
  "inline-flex min-h-11 items-center rounded-md px-2.5 text-primary underline-offset-2 hover:underline";

const kb = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`);

/**
 * Drag-and-drop target with a keyboard-accessible "Choose file" button (the zone itself is never the only
 * way in). States: idle (dashed), drag-over (solid lime-soft, icon lifts), reading (spinner), loaded (file
 * chip). Samples are generated on click. Nothing here reads any other website.
 */
export function DropZone({
  onFile,
  onSampleJson,
  onSampleCsv,
  disabled,
  reading,
  loaded,
}: DropZoneProps) {
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const { reduce } = useMotionPrefs();
  const state = reading ? "reading" : over ? "over" : loaded ? "loaded" : "idle";

  return (
    <div
      data-testid="drop-zone"
      data-over={over}
      data-state={state}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file && !disabled) onFile(file);
      }}
      className={cn(
        "flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl border-2 p-6 text-center transition-[background-color,border-color,box-shadow] duration-200",
        over
          ? "border-solid border-primary-border bg-primary-soft ring-4 ring-primary/10"
          : loaded && !reading
            ? "border-solid border-positive/40 bg-positive-soft/40"
            : "border-dashed border-border-control bg-subtle/40",
      )}
    >
      <motion.span
        aria-hidden="true"
        className={cn(
          "grid size-12 place-items-center rounded-full border",
          over ? "border-primary-border bg-primary-soft text-primary" : "border-hairline bg-subtle",
          loaded && !over && !reading && "border-positive/40 text-positive",
        )}
        animate={{ y: over && !reduce ? -4 : 0, scale: over && !reduce ? 1.08 : 1 }}
        transition={SPRING}
      >
        {reading ? (
          <Loader2Icon className="size-6 animate-spin text-primary" />
        ) : loaded && !over ? (
          <CheckCircle2Icon className="size-6" />
        ) : (
          <UploadCloudIcon className={cn("size-6", over ? "text-primary" : "text-faint")} />
        )}
      </motion.span>

      <div className="min-h-12" aria-live="polite">
        {reading ? (
          <p className="text-body">Reading file…</p>
        ) : over ? (
          <p className="text-body font-medium text-primary">Release to load this file</p>
        ) : loaded ? (
          <>
            <p className="text-body inline-flex max-w-full items-center gap-2 font-medium">
              <FileTextIcon className="size-4 shrink-0 text-faint" aria-hidden="true" />
              <span className="truncate" data-testid="loaded-file">
                {loaded.name}
              </span>
            </p>
            <p className="text-caption num text-faint">{kb(loaded.size)} loaded</p>
          </>
        ) : (
          <>
            <p className="text-body">Drop a JSON or CSV file here</p>
            <p className="text-caption text-faint">or choose one from your device</p>
          </>
        )}
      </div>

      <Button
        type="button"
        variant="secondary"
        disabled={disabled || reading}
        onClick={() => input.current?.click()}
      >
        {loaded ? "Replace file" : "Choose file"}
      </Button>
      <input
        ref={input}
        type="file"
        accept=".json,.csv,.txt,application/json,text/csv,text/plain"
        aria-label="Choose a JSON or CSV file"
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // choosing the same file again must fire again
          if (file) onFile(file);
        }}
      />
      <p className="text-caption flex flex-wrap items-center justify-center gap-x-1 text-faint">
        <span>Max 1 MB</span>
        <span aria-hidden="true">·</span>
        <span>Download a sample:</span>
        <button type="button" onClick={onSampleJson} className={sampleLink}>
          JSON
        </button>
        <button type="button" onClick={onSampleCsv} className={sampleLink}>
          CSV
        </button>
      </p>
    </div>
  );
}
