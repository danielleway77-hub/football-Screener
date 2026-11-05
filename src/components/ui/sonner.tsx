"use client";

import * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

/** Dark-only app (no theme provider). Top-centre below the navbar on phones, bottom-right otherwise. */
function useIsMobile() {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}

const Toaster = ({ ...props }: ToasterProps) => {
  const mobile = useIsMobile();

  return (
    <Sonner
      theme="dark"
      position={mobile ? "top-center" : "bottom-right"}
      offset={16}
      mobileOffset={{ top: 72, left: 16, right: 16 }}
      visibleToasts={3}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-positive" />,
        info: <InfoIcon className="size-4 text-info" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-negative" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--surface-overlay)",
          "--normal-text": "var(--text)",
          "--normal-border": "var(--hairline-strong)",
          "--border-radius": "var(--radius-md)",
          zIndex: "var(--z-toast)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
