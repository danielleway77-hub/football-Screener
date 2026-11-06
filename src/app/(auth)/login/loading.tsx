import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="bg-grad-hero flex min-h-dvh items-center justify-center px-4">
      <Skeleton className="h-72 w-full max-w-[400px] rounded-xl" />
    </div>
  );
}
