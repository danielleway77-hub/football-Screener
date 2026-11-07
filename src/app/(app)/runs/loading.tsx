import { HeaderSkeleton } from "@/components/states/Skeletons";
import { RunsSkeleton } from "@/components/runs/RunsSkeleton";

export default function Loading() {
  return (
    <div className="container-wide space-y-6">
      <HeaderSkeleton />
      <RunsSkeleton />
    </div>
  );
}
