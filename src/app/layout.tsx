import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { APP_NAME, THEME_COLOR } from "@/lib/brand";
import { RouteProgress } from "@/components/states/RouteProgress";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Self-hosted variable fonts (Fontsource): builds and tests never depend on Google Fonts being reachable.
const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  adjustFontFallback: "Arial", // size-adjusted fallback: no layout shift on font swap (§30 #27)
  weight: "100 900",
  display: "swap",
});

const spaceGrotesk = localFont({
  src: "../../node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2",
  variable: "--font-space-grotesk",
  adjustFontFallback: "Arial",
  weight: "300 700",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  variable: "--font-jetbrains",
  weight: "100 800",
  display: "swap",
});
export const metadata: Metadata = {
  // Absolute base for og:image / twitter:image (Vercel sets the production host; local falls back to localhost).
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : `http://localhost:${process.env.PORT ?? 3000}`,
  ),
  title: { default: "Screener", template: "%s · Screener" },
  description: "Private football match screening dashboard.",
  applicationName: "Screener",
  robots: { index: false, follow: false },
  openGraph: {
    title: APP_NAME,
    siteName: APP_NAME,
    description: "Private football match screening dashboard.",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: APP_NAME },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR, // = --bg-base
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <RouteProgress />
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
