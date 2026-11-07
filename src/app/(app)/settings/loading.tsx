import { PageContainer } from "@/components/layout/PageContainer";
import { SettingsSkeleton } from "@/components/settings/SettingsSkeleton";
import { HeaderSkeleton } from "@/components/states/Skeletons";

export default function Loading() {
  return (
    <PageContainer width="wide" className="space-y-6">
      <HeaderSkeleton />
      <SettingsSkeleton />
    </PageContainer>
  );
}
