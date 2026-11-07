import { LoginFormSkeleton } from "@/components/auth/LoginSkeleton";
import { PitchBackdrop } from "@/components/auth/PitchBackdrop";
import { Logo } from "@/components/shared/Logo";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the final page (logo, title, subtitle, form) so the swap is shift-free. */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="bg-grad-hero noise relative flex min-h-dvh flex-1 items-center justify-center overflow-clip px-6 py-10"
    >
      <PitchBackdrop />
      <div className="relative z-10 w-full max-w-[420px] space-y-8 accent-border max-md:before:hidden md:rounded-2xl md:bg-surface md:p-10">
        <Logo size={32} />
        <div className="space-y-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-5 w-64 max-w-full" />
        </div>
        <LoginFormSkeleton />
      </div>
    </main>
  );
}
