"use client";

import * as React from "react";
import { UploadCloudIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DropZoneProps = {
  onFile: (file: File) => void;
  onSampleJson: () => void;
  onSampleCsv: () => void;
  disabled?: boolean;
};

const sampleLink =
  "inline-flex min-h-6 items-center text-primary underline-offset-2 hover:underline";

/**
 * Drag-and-drop target with a keyboard-accessible "Choose file" button (the zone itself is never the only
 * way in). Drag-over turns the dashed border solid lime-soft. Samples are generated on click.
 */
export function DropZone({ onFile, onSampleJson, onSampleCsv, disabled }: DropZoneProps) {
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);

  return (
    <div
      data-testid="drop-zone"
      data-over={over}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file && !disabled) onFile(file);
      }}
      className={cn(
        "flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border-2 p-6 text-center transition-colors",
        over
          ? "border-solid border-primary-border bg-primary-soft"
          : "border-dashed border-border-control bg-subtle/40",
      )}
    >
      <UploadCloudIcon className="size-7 text-faint" aria-hidden="true" />
      <p className="text-body">Drop a JSON or CSV file here</p>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        Choose file
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
      <p className="text-caption flex flex-wrap items-center justify-center gap-x-2 text-faint">
        <span>Max 1 MB</span>
        <span aria-hidden="true">·</span>
        <span>Sample:</span>
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
