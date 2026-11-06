import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RouteFocus } from "@/components/layout/RouteFocus";
import { OfflineBanner } from "@/components/states/OfflineBanner";
import { FreshnessGate, NavFreshness } from "./freshness-gate";
import { requireSession } from "@/server/auth/guard";

/** Reads the session (cookies + DB) at request time, so it must sit inside Suspense (Cache Components). */
async function SessionGate({ children }: { children: React.ReactNode }) {
  await requireSession();
  return <>{children}</>;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      freshness={
        <Suspense fallback={<span className="inline-block h-8 min-w-[150px]" />}>
          <NavFreshness />
        </Suspense>
      }
      banners={
        <>
          <Suspense fallback={null}>
            <FreshnessGate />
          </Suspense>
          <OfflineBanner />
        </>
      }
    >
      <RouteFocus />
      <Suspense fallback={null}>
        <SessionGate>{children}</SessionGate>
      </Suspense>
    </AppShell>
  );
}
