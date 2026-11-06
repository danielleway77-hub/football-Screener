import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/layout/BackLink";
import { ForceError } from "@/components/layout/ForceError";
import { PageContainer } from "@/components/layout/PageContainer";
import { Skeleton } from "@/components/ui/skeleton";

// Becomes "{Home} vs {Away}" once match data exists (Step 12).
export const metadata: Metadata = { title: "Match detail" };

export default function MatchDetailPage({ searchParams }: PageProps<"/matches/[id]">) {
  return (
    <PageContainer width="wide" className="space-y-6">
      <Suspense fallback={null}>
        <ForceError searchParams={searchParams} />
      </Suspense>
      <h1 className="sr-only">Match detail</h1>
      <BackLink href="/" />
      <Skeleton className="h-40 w-full rounded-xl md:h-52" aria-hidden="true" />
    </PageContainer>
  );
}
