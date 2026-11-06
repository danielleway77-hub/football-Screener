import { AppShell } from "@/components/layout/AppShell";
import { RouteFocus } from "@/components/layout/RouteFocus";
import { OfflineBanner } from "@/components/states/OfflineBanner";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell banners={<OfflineBanner />}>
      <RouteFocus />
      {children}
    </AppShell>
  );
}
