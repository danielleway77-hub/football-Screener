"use client";

import * as React from "react";
import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  /** May throw: the message is shown inline and the dialog stays open. */
  onConfirm: () => Promise<void> | void;
};

/**
 * Confirmation for irreversible actions. Initial focus goes to the LEAST destructive button
 * (Cancel), the confirm button shows a loading state, and failures appear inline.
 * On phones (< 640px) the dialog is a bottom sheet with stacked buttons (Confirm first).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
}: ConfirmDialogProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset transient state whenever the dialog closes (derive state during render).
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setPending(false);
      setError(null);
    }
  }

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
        onInteractOutside={(event) => {
          if (tone === "destructive" || pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-h3">{title}</DialogTitle>
          <DialogDescription className="text-body-sm text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-negative/30 bg-negative-soft p-3 text-sm text-negative"
          >
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            ref={cancelRef}
            variant="ghost"
            disabled={pending}
            onClick={() => onOpenChange(false)}
            className="max-sm:w-full"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "destructive" ? "destructive" : "default"}
            loading={pending}
            onClick={confirm}
            className="max-sm:w-full"
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
