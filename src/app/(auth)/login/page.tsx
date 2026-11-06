import type { Metadata } from "next";
import { LogoGlyph } from "@/components/shared/Logo";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sign in" };

/** Placeholder form; real auth lands in Step 6. No navbar/footer on this route. */
export default function LoginPage() {
  return (
    <main
      id="main"
      className="bg-grad-hero flex min-h-dvh flex-1 items-center justify-center px-4 py-10 md:px-6"
    >
      <div className="w-full max-w-[400px] space-y-6 md:rounded-xl md:border md:border-hairline md:bg-surface md:p-8">
        <LogoGlyph size={36} />
        <h1 className="text-h1">Sign in</h1>
        <form className="space-y-4" noValidate>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <PasswordInput id="password" name="password" autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
        <p className="text-caption text-faint">Personal use only.</p>
      </div>
    </main>
  );
}
