import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder for the form block: same heights as label + input + hint + button + footnote (no layout shift). */
export function LoginFormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true" data-testid="login-form-skeleton">
      <div>
        <Skeleton className="mb-2 h-5 w-20" />
        <Skeleton className="h-11 w-full rounded-md" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>
      <Skeleton className="h-12 w-full rounded-md" />
      <Skeleton className="h-4 w-28" />
    </div>
  );
}
