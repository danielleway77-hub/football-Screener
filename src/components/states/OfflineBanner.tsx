"use client";

import * as React from "react";
import { CheckCircle2Icon, WifiOffIcon } from "lucide-react";
import { Banner } from "@/components/states/Banner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * "You're offline" while disconnected; "Back online." for 3 s after reconnecting.
 * Under the navbar, announced with role="status".
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const [showRecovered, setShowRecovered] = React.useState(false);
  const wasOffline = React.useRef(false);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onOffline = () => {
      wasOffline.current = true;
      setShowRecovered(false);
    };
    const onOnline = () => {
      if (!wasOffline.current) return;
      wasOffline.current = false;
      setShowRecovered(true);
      timer = setTimeout(() => setShowRecovered(false), 3000);
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    if (!navigator.onLine) wasOffline.current = true;
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!online) {
    return (
      <Banner tone="warning" icon={WifiOffIcon}>
        You&apos;re offline. Changes can&apos;t be saved until you reconnect.
      </Banner>
    );
  }
  if (showRecovered) {
    return (
      <Banner tone="positive" icon={CheckCircle2Icon}>
        Back online.
      </Banner>
    );
  }
  return null;
}
