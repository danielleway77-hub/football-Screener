import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ForceError } from "@/components/layout/ForceError";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { RadarIllustration } from "@/components/illustrations";
import { EmptyState } from "@/components/states/EmptyState";
import { StatSkeleton } from "@/components/states/Skeletons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Dashboard" };

/** Placeholder body; the real dashboard arrives in Step 10. */
export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <PageContainer width="wide" className="space-y-6">
      <Suspense fallback={null}>
        <ForceError searchParams={searchParams} />
      </Suspense>
      <SectionHeader
        overline="DASHBOARD"
        title="Qualifying matches"
        description="Form above 75% vs below 35%"
      />
      <Skeleton className="h-32 w-full rounded-lg lg:ml-auto lg:w-[400px]" aria-hidden="true" />
      <StatSkeleton />
      <EmptyState
        illustration={<RadarIllustration size={160} />}
        title="No matches yet"
        description="Update your data to see matches where one team is in strong form and the other is not."
        actions={
          <Button asChild>
            <Link href="/import">Update data</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
