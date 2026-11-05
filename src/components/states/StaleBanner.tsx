import { AlertTriangleIcon } from "lucide-react";
import { Banner } from "@/components/states/Banner";

type StaleBannerProps = {
  /** Whole hours since the last successful update. */
  hours: number;
  action?: React.ReactNode;
};

export function StaleBanner({ hours, action }: StaleBannerProps) {
  return (
    <Banner tone="warning" icon={AlertTriangleIcon} action={action}>
      Data is {hours} {hours === 1 ? "hour" : "hours"} old.
    </Banner>
  );
}
