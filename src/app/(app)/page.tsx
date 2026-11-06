import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { DashboardSkeleton } from "@/components/states/Skeletons";
import { DashboardContent } from "./dashboard-content";

export const metadata: Metadata = { title: "Dashboard" };

/** Dashboard: all data is read at request time inside Suspense (Cache Components). */
export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <PageContainer width="wide">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}
