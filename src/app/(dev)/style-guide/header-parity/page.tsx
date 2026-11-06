import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { HeaderSkeleton } from "@/components/states/Skeletons";

export const metadata: Metadata = { title: "Header parity" };

/** Dev-only: real page header and its skeleton side by side, measured by e2e (404 in production). */
export default function HeaderParityPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <PageContainer width="wide" className="space-y-10 py-10">
      <div data-testid="real-header">
        <SectionHeader
          overline="RUNS"
          title="Run history"
          description="Every check the system has made."
        />
      </div>
      <div data-testid="skeleton-header">
        <HeaderSkeleton />
      </div>
    </PageContainer>
  );
}
