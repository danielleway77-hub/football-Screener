import type { Metadata } from "next";
import { NotFoundView } from "@/components/states/NotFoundView";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main id="main" className="flex flex-1 items-center justify-center">
      <NotFoundView />
    </main>
  );
}
