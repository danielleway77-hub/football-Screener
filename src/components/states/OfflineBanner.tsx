"use client";

import * as React from "react";
import { CheckCircle2Icon, WifiOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/states/Banner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * "You're offline" while disconnected; "Back online." for 3 s after reconnecting.
 * Under the navbar, announced with role="status".
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const router = useRouter();
  const [showRecovered, setShowRecovered] = React.useState(false);
  const wasOffline = React.useRef(false);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onOffline = () => {
      wasOffline.current = true;
      setShowRecovered(false);
    };
    const onOnline = () => {
      if (timer) clearTimeout(timer);
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
      // Refresh re-reads the current view (GET only); nothing that failed offline is replayed.
      <Banner
        tone="positive"
        icon={CheckCircle2Icon}
        action={
          <Button size="xs" variant="secondary" onClick={() => router.refresh()}>
            Refresh
          </Button>
        }
      >
        Back online.
      </Banner>
    );
  }
  return null;
}
