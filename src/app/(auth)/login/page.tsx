import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { Logo } from "@/components/shared/Logo";

export const metadata: Metadata = { title: "Sign in" };

/** No navbar and no footer on this route. Mobile: open column. ≥768px: 420px card. */
export default function LoginPage() {
  return (
    <main
      id="main"
      className="bg-grad-hero noise flex min-h-dvh flex-1 scroll-py-8 items-center justify-center px-6 py-10"
    >
      <div className="w-full max-w-[420px] space-y-8 accent-border max-md:before:hidden md:rounded-2xl md:bg-surface md:p-10">
        <Logo size={32} />
        <div className="space-y-2">
          <h1 className="text-h1">Sign in</h1>
          <p className="text-body-sm text-muted-foreground">
            Private dashboard for your football screening.
          </p>
        </div>
        <Suspense fallback={<div className="h-56" aria-hidden="true" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
