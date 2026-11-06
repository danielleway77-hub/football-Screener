import type { Metadata } from "next";
import { Suspense } from "react";
import { ForceError } from "@/components/layout/ForceError";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { FunnelSearchIllustration } from "@/components/illustrations";
import { EmptyState } from "@/components/states/EmptyState";

export const metadata: Metadata = { title: "Runs" };

export default function RunsPage({ searchParams }: PageProps<"/runs">) {
  return (
    <PageContainer width="wide" className="space-y-6">
      <Suspense fallback={null}>
        <ForceError searchParams={searchParams} />
      </Suspense>
      <SectionHeader
        overline="RUNS"
        title="Run history"
        description="Every check the system has made."
      />
      <EmptyState
        illustration={<FunnelSearchIllustration size={160} />}
        title="No runs yet"
        description="Runs appear here after your first data update."
      />
    </PageContainer>
  );
}
