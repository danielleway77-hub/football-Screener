"use client";

import "./globals.css";

/** Last-resort boundary: replaces the root layout, so it renders its own <html>/<body>. */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="flex min-h-full flex-col items-center justify-center">
        <main className="mx-auto flex min-h-[70dvh] max-w-[480px] flex-col items-center justify-center px-6 text-center">
          <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-negative-soft text-negative">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6M9 9l6 6" />
            </svg>
          </div>
          <h1 className="text-h2">Something went wrong</h1>
          <p className="text-body-sm mt-2 text-muted-foreground">
            We couldn&apos;t complete that. Try again.
          </p>
          <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-[filter,transform] duration-150 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none active:scale-[0.98]"
            >
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- the router may be broken here */}
            <a
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Dashboard
            </a>
          </div>
          <details className="text-caption mt-6 text-faint">
            <summary className="cursor-pointer">Technical details</summary>
            <p className="mt-2 font-mono">{error.digest ?? "UNKNOWN"}</p>
          </details>
        </main>
      </body>
    </html>
  );
}
