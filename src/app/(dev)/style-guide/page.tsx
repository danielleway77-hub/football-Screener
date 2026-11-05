import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StyleGuideClient } from "./style-guide-client";

export const metadata: Metadata = { title: "Style guide" };

/** Dev-only design specimen page. Returns 404 in production builds (Step 2.1 requirement). */
export default function StyleGuidePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <StyleGuideClient />;
}
