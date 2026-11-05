import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

type AppShellProps = {
  children: React.ReactNode;
  /** Optional freshness text for the footer slot. */
  lastUpdated?: string;
  /** Banner slot rendered between the navbar and <main> (offline / stale banners). */
  banners?: React.ReactNode;
};

/**
 * Frame for every authenticated page. Pages render ONLY their content inside it — no page ever
 * defines its own navbar, footer or container (docs/CODING_STANDARDS.md §6).
 */
export function AppShell({ children, lastUpdated, banners }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Navbar />
      {banners}
      <main id="main" tabIndex={-1} className="flex-1 pt-6 pb-14 outline-none md:pt-8 xl:pt-10">
        {children}
      </main>
      <Footer lastUpdated={lastUpdated} />
    </div>
  );
}
