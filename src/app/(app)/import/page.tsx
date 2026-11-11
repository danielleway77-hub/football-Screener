import type { Metadata } from "next";
import { Suspense } from "react";
import { ForceError } from "@/components/layout/ForceError";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { FormSkeleton } from "@/components/states/Skeletons";
import { ImportContent } from "./import-content";

export const metadata: Metadata = { title: "Import" };

export default function ImportPage({ searchParams }: PageProps<"/import">) {
  return (
    <PageContainer width="wide" className="mx-auto max-w-[880px] space-y-6">
      <Suspense fallback={null}>
        <ForceError searchParams={searchParams} />
      </Suspense>
      <SectionHeader
        overline="DATA INTAKE"
        title="Update your matches"
        description="Send new match data to your dashboard."
        className="items-center text-center md:flex-col md:items-center md:justify-center [&_p]:mx-auto"
      />
      <Suspense fallback={<FormSkeleton />}>
        <ImportContent />
      </Suspense>
    </PageContainer>
  );
}
