"use client";

import { RouteError } from "@/components/states/RouteError";

export default function Error(props: { error: Error; retry: () => void }) {
  return <RouteError {...props} />;
}
