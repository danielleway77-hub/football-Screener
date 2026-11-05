import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/layout/SectionHeader";

export const metadata: Metadata = { title: "Shell demo" };

/** Dev-only: the real AppShell around a short page (404 in production). Used by e2e layout tests. */
export default function ShellDemoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <AppShell lastUpdated="Data updated Today 06:58">
      <PageContainer width="wide">
        <SectionHeader
          overline="DEMO"
          title="App shell"
          description="A deliberately short page: the footer must still sit at the bottom of the viewport."
        />
      </PageContainer>
    </AppShell>
  );
}
