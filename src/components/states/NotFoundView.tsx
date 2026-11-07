import Link from "next/link";
import { NotFoundIllustration } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/Reveal";

/** Branded 404 body (UI_BLUEPRINT §11). Used by the root and the (app) `not-found.tsx` files. */
export function NotFoundView() {
  return (
    <div
      data-testid="not-found"
      className="mx-auto flex min-h-[70dvh] max-w-[480px] flex-col items-center justify-center px-6 py-12 text-center"
    >
      <Reveal>
        <div className="mb-4 text-faint">
          <NotFoundIllustration size={160} />
        </div>
      </Reveal>
      <Reveal delay={0.08}>
        <p className="text-stat-xl text-faint" aria-hidden="true">
          404
        </p>
        <h1 className="text-h1 mt-3">Page not found</h1>
        <p className="text-body-sm mt-3 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
      </Reveal>
      <Reveal delay={0.16} className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Button asChild size="default" className="max-sm:w-full">
          <Link href="/">Back to dashboard</Link>
        </Button>
        <Button asChild size="default" variant="ghost" className="max-sm:w-full">
          <Link href="/runs">View runs</Link>
        </Button>
      </Reveal>
    </div>
  );
}
