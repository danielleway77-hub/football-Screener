"use client";

import * as React from "react";
import Link from "next/link";
import { BackLink } from "@/components/layout/BackLink";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CopyButton } from "@/components/shared/CopyButton";
import { ExternalLink } from "@/components/shared/ExternalLink";
import { HelperText } from "@/components/shared/HelperText";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";

/** Specimens for Step 3.1 (layout kit and shared blocks). */
export function LayoutKitDemos() {
  const [open, setOpen] = React.useState(false);
  const [failOpen, setFailOpen] = React.useState(false);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h3 className="text-overline text-muted-foreground">Logo</h3>
        <div className="flex flex-wrap items-center gap-8">
          {([20, 24, 28, 32] as const).map((size) => (
            <Logo key={size} size={size} />
          ))}
          <Logo variant="glyph" size={32} />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-overline text-muted-foreground">Section header & back link</h3>
        <BackLink href="#layout-kit" />
        <SectionHeader
          overline="DASHBOARD"
          title="Qualifying matches"
          description="Form above 75% vs below 35%"
          actions={<Button size="sm">Update data</Button>}
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-overline text-muted-foreground">Application shell</h3>
        <p className="text-body-sm text-muted-foreground">
          The real shell (navbar, skip link, main, footer) is shown on its own page.
        </p>
        <Button asChild variant="secondary" size="sm">
          <Link href="/style-guide/shell">Open shell demo</Link>
        </Button>
      </div>

      <div className="space-y-3">
        <h3 className="text-overline text-muted-foreground">
          Confirm dialog, copy button, helper text, external link
        </h3>
        <div className="flex flex-wrap items-start gap-4">
          <Button variant="destructive" onClick={() => setOpen(true)}>
            Revoke token…
          </Button>
          <Button variant="secondary" onClick={() => setFailOpen(true)}>
            Confirm that fails…
          </Button>
          <CopyButton value="scr_example_token_value" label="Copy token" />
          <ExternalLink href="https://example.com">Open on PrediGoal</ExternalLink>
        </div>
        <div className="max-w-sm">
          <Button disabled>Save changes</Button>
          <HelperText>You&apos;re offline. Reconnect to save.</HelperText>
        </div>
      </div>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="destructive"
        title={'Revoke "Home laptop"?'}
        description="The helper using it will stop working."
        confirmLabel="Revoke"
        onConfirm={async () => {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }}
      />
      <ConfirmDialog
        open={failOpen}
        onOpenChange={setFailOpen}
        title="Re-screen stored matches?"
        description="This applies your current thresholds to every stored match."
        confirmLabel="Re-screen"
        onConfirm={async () => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          throw new Error("The server didn't respond. Try again.");
        }}
      />
    </div>
  );
}
