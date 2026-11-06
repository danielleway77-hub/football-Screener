import type { Metadata } from "next";
import { NotFoundView } from "@/components/states/NotFoundView";

export const metadata: Metadata = { title: "Page not found" };

/** notFound() inside the app shell: the shell already provides <main>, so no second landmark here. */
export default function AppNotFound() {
  return <NotFoundView />;
}
