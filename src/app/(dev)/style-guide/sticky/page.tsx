import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { StickyDemo } from "./sticky-demo";

export const metadata: Metadata = { title: "Sticky bar demo" };

/** Dev-only: StickyBar inside the real AppShell (404 in production). */
export default function StickyDemoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <AppShell>
      <StickyDemo />
    </AppShell>
  );
}
