import type { Metadata } from "next";
import { Suspense } from "react";
import { ForceError } from "@/components/layout/ForceError";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Import" };

/** Placeholder: tab bar disabled + card. Real intake UI arrives in Step 11. */
export default function ImportPage({ searchParams }: PageProps<"/import">) {
  return (
    <PageContainer width="wide" className="space-y-6">
      <Suspense fallback={null}>
        <ForceError searchParams={searchParams} />
      </Suspense>
      <SectionHeader
        overline="DATA INTAKE"
        title="Update your matches"
        description="Send new match data to your dashboard."
      />
      <div className="flex gap-2" aria-hidden="true">
        {["Paste", "Upload", "Helper"].map((t) => (
          <Skeleton key={t} className="h-10 w-24 rounded-full" />
        ))}
      </div>
      <Card>
        <CardContent>
          <p className="text-body-sm text-muted-foreground">
            Import tools are coming in a later step.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
