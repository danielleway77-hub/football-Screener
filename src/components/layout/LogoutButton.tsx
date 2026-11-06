"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type LogoutButtonProps = {
  /** `icon` = 40×40 ghost icon (desktop navbar); `row` = full-width destructive row (mobile sheet). */
  variant?: "icon" | "row";
  onDone?: () => void;
  className?: string;
};

export function LogoutButton({ variant = "icon", onDone, className }: LogoutButtonProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const online = useOnlineStatus();
  const busy = React.useRef(false);

  async function logout() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok && res.status !== 404) throw new Error(String(res.status));
      onDone?.();
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Couldn't log out. Check your connection and try again.", { duration: 8000 });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={logout}
        disabled={pending || !online}
        title={online ? undefined : "You're offline. Reconnect to log out."}
        className={cn(
          "flex h-14 w-full items-center gap-3.5 rounded-md px-4 text-[1.0625rem] font-semibold text-negative transition-colors hover:bg-negative-soft disabled:opacity-60",
          className,
        )}
      >
        <LogOutIcon className="size-[22px]" aria-hidden="true" />
        Log out
      </button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Log out"
          onClick={logout}
          disabled={pending || !online}
          className={cn("size-10", className)}
        >
          <LogOutIcon aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {online ? "Log out" : "You're offline. Reconnect to log out."}
      </TooltipContent>
    </Tooltip>
  );
}
