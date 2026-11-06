import type { Metadata } from "next";
import { Suspense } from "react";
import { ForceError } from "@/components/layout/ForceError";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { TableSkeleton } from "@/components/states/Skeletons";
import { RunsContent } from "./runs-content";

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
      <Suspense fallback={<TableSkeleton />}>
        <RunsContent searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}
