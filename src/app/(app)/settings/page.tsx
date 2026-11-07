import type { Metadata } from "next";
import { Suspense } from "react";
import { ForceError } from "@/components/layout/ForceError";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SettingsSkeleton } from "@/components/settings/SettingsSkeleton";
import { SettingsContent } from "./settings-content";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <PageContainer width="wide" className="space-y-6">
      <Suspense fallback={null}>
        <ForceError searchParams={searchParams} />
      </Suspense>
      <SectionHeader
        overline="SETTINGS"
        title="Settings"
        description="Control the rule, schedule and access."
      />
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </PageContainer>
  );
}
