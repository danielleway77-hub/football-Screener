"use client";

import * as React from "react";
import { formatInTimeZone } from "date-fns-tz";
import { AlertTriangleIcon, KeyRoundIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useMotionPrefs } from "@/lib/motion";
import { Callout } from "@/components/shared/Callout";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CopyButton } from "@/components/shared/CopyButton";
import { HelperText } from "@/components/shared/HelperText";
import { EmptyState } from "@/components/states/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { AppClientError, fetchJson } from "@/lib/fetcher";
import { MAX_ACTIVE_TOKENS } from "@/lib/schemas/settings";
import { cn } from "@/lib/utils";

export type TokenRow = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type Created = { id: string; label: string; token: string };

const day = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, "d MMM yyyy");
const stamp = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, "d MMM, HH:mm");

function TokenStatus({ revoked }: { revoked: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-2 rounded-4xl border px-2.5 text-xs font-bold tracking-[0.08em]",
        revoked
          ? "border-hairline-strong bg-neutral-soft text-muted-foreground"
          : "border-positive/40 bg-positive-soft text-positive",
      )}
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-current" />
      {revoked ? "REVOKED" : "ACTIVE"}
    </span>
  );
}

/**
 * Ingest tokens: create (the plaintext is shown ONCE in the modal), list, revoke. At most 5 active.
 * The list endpoint never returns plaintext, so a token cannot be shown again after the modal closes.
 */
export function TokenManager({
  initialTokens,
  timezone,
}: {
  initialTokens: TokenRow[];
  timezone: string;
}) {
  const online = useOnlineStatus();
  const { reduce } = useMotionPrefs();
  const [tokens, setTokens] = React.useState(initialTokens);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [label, setLabel] = React.useState("");
  const [labelError, setLabelError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [created, setCreated] = React.useState<Created | null>(null);
  const [doneReady, setDoneReady] = React.useState(false);
  const [revoking, setRevoking] = React.useState<TokenRow | null>(null);

  const active = tokens.filter((t) => !t.revokedAt).length;
  const full = active >= MAX_ACTIVE_TOKENS;

  // "Done" unlocks once the token was copied, or after 3 seconds.
  React.useEffect(() => {
    if (!created) return;
    const timer = setTimeout(() => setDoneReady(true), 3000);
    return () => clearTimeout(timer);
  }, [created]);

  function openCreate() {
    setLabel("");
    setLabelError(null);
    setCreated(null);
    setDoneReady(false);
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    setCreated(null); // the plaintext is dropped from memory here
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const clean = label.trim();
    if (clean.length < 1 || clean.length > 40) {
      setLabelError(clean.length < 1 ? "Give the token a name." : "Use 40 characters or fewer.");
      return;
    }
    setCreating(true);
    setLabelError(null);
    try {
      const result = await fetchJson<Created>("/api/tokens", {
        method: "POST",
        body: { label: clean },
      });
      setCreated(result);
      setTokens((list) => [
        {
          id: result.id,
          label: result.label,
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
          revokedAt: null,
        },
        ...list,
      ]);
    } catch (error) {
      setLabelError(
        error instanceof AppClientError
          ? (error.fieldErrors?.label?.[0] ?? error.message)
          : "We couldn't create the token. Try again.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function revoke(token: TokenRow) {
    await fetchJson(`/api/tokens/${token.id}`, { method: "DELETE" });
    const at = new Date().toISOString();
    setTokens((list) => list.map((t) => (t.id === token.id ? { ...t, revokedAt: at } : t)));
    toast.success(`Token "${token.label}" revoked.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-sm text-muted-foreground">
          {active} of {MAX_ACTIVE_TOKENS} active tokens
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={openCreate}
          disabled={full || !online}
          className="max-sm:w-full"
        >
          Create token
        </Button>
      </div>
      {full ? (
        <HelperText noIcon={false}>
          You have {MAX_ACTIVE_TOKENS} active tokens. Revoke one to create another.
        </HelperText>
      ) : !online ? (
        <HelperText>You&apos;re offline. Reconnect to manage tokens.</HelperText>
      ) : null}

      {tokens.length === 0 ? (
        <EmptyState
          icon={KeyRoundIcon}
          title="No tokens yet"
          description="Create a token if you use the one-click helper."
          className="py-6"
        />
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-md border border-hairline">
          <AnimatePresence initial={false}>
            {tokens.map((token) => (
              <motion.li
                key={token.id}
                layout={reduce ? false : "position"}
                initial={reduce ? false : { opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                data-testid="token-row"
                className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-subtle"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-md border",
                    token.revokedAt
                      ? "border-hairline bg-neutral-soft text-faint"
                      : "border-primary-border bg-primary-soft text-primary",
                  )}
                >
                  <KeyRoundIcon className="size-4" />
                </span>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="text-body truncate font-semibold">{token.label}</p>
                  <p className="text-caption text-faint">
                    Created {day(token.createdAt, timezone)} · Last used{" "}
                    {token.lastUsedAt ? stamp(token.lastUsedAt, timezone) : "never"}
                  </p>
                </div>
                <TokenStatus revoked={Boolean(token.revokedAt)} />
                {token.revokedAt ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!online}
                    onClick={() => setRevoking(token)}
                    aria-label={`Revoke ${token.label}`}
                  >
                    Revoke
                  </Button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (open) return;
          // Once the token is shown, only the Done button closes the dialog (no accidental loss).
          if (created && !doneReady) return;
          closeCreate();
        }}
      >
        <DialogContent
          showCloseButton={!created}
          onInteractOutside={(e) => created && e.preventDefault()}
          onEscapeKeyDown={(e) => created && !doneReady && e.preventDefault()}
        >
          {created ? (
            <div className="space-y-4" data-testid="token-created">
              <DialogHeader>
                <DialogTitle className="text-h3">Token created</DialogTitle>
                <DialogDescription className="text-body-sm text-muted-foreground">
                  Paste it into the helper for &ldquo;{created.label}&rdquo;.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 rounded-md bg-subtle p-3 sm:flex-row sm:items-center">
                <motion.code
                  data-testid="token-plaintext"
                  initial={reduce ? false : { opacity: 0, filter: "blur(6px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                  className="num min-w-0 flex-1 text-sm break-all text-foreground"
                >
                  {created.token}
                </motion.code>
                <CopyButton
                  value={created.token}
                  label="Copy token"
                  onCopied={() => setDoneReady(true)}
                />
              </div>
              <Callout tone="warning" title="Copy it now — you won't see it again." />
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={!doneReady}
                  onClick={closeCreate}
                  className="max-sm:w-full"
                >
                  Done
                </Button>
              </div>
              {doneReady ? null : (
                <HelperText noIcon>Copy the token, or wait a moment, to continue.</HelperText>
              )}
            </div>
          ) : (
            <form onSubmit={create} noValidate className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-h3">Create token</DialogTitle>
                <DialogDescription className="text-body-sm text-muted-foreground">
                  Name it after the device or browser that will use it.
                </DialogDescription>
              </DialogHeader>
              <div>
                <label htmlFor="token-label" className="mb-2 block text-sm font-medium">
                  Label
                </label>
                <Input
                  id="token-label"
                  value={label}
                  maxLength={60}
                  autoComplete="off"
                  placeholder="Home laptop"
                  onChange={(e) => setLabel(e.target.value)}
                  aria-invalid={labelError ? true : undefined}
                  aria-describedby={labelError ? "token-label-error" : undefined}
                />
                {labelError ? (
                  <p
                    id="token-label-error"
                    role="alert"
                    className="mt-2 flex items-center gap-1.5 text-sm text-negative"
                  >
                    <AlertTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
                    {labelError}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeCreate}
                  className="max-sm:w-full"
                >
                  Cancel
                </Button>
                <Button type="submit" loading={creating} className="max-sm:w-full">
                  Create token
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={`Revoke "${revoking?.label ?? ""}"?`}
        description="The helper using it will stop working."
        confirmLabel="Revoke"
        tone="destructive"
        onConfirm={async () => {
          if (revoking) await revoke(revoking);
        }}
      />
    </div>
  );
}
