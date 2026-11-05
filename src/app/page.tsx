import { Button } from "@/components/ui/button";

/** Temporary placeholder: replaced by the real dashboard shell in Steps 4 and 10. */
export default function Home() {
  return (
    <main className="bg-grad-hero container-content flex flex-1 flex-col items-start justify-center gap-4 py-24">
      <p className="text-overline text-primary">Screener</p>
      <h1 className="text-h1">Football match screener</h1>
      <p className="text-body-sm max-w-prose text-muted-foreground">
        Private dashboard for matches where one team&apos;s form is above 75% and the other&apos;s
        is below 35%. The app is under construction.
      </p>
      <Button asChild variant="secondary">
        <a href="/style-guide">Open style guide (dev)</a>
      </Button>
    </main>
  );
}
