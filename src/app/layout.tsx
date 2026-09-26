import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "./providers";
import { fontVariables } from "./fonts";
import { AnalyticsGate } from "@/components/AnalyticsGate";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { siteMetadataBase } from "@/lib/foundation/site";
import { ui } from "@/lib/foundation/jeopardy-style";

const title = "Jeopardy";
const description =
  "Multiplayer Jeopardy with AI bots, voice readout, and host controls. Share a room link and buzz in from your phone.";

export const metadata: Metadata = {
  metadataBase: siteMetadataBase(),
  title,
  description,
  manifest: "/manifest.webmanifest",
  applicationName: title,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // `black-translucent` draws the page under the iOS status bar; the shell
  // pads for it with `env(safe-area-inset-*)` (see `viewportFit` below).
  appleWebApp: { title, capable: true, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: title,
    title,
    description,
    url: "/",
    locale: "en_US",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Jeopardy! — a game board of dollar values" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  // One colour everywhere: this meta, the manifest's theme/background, and
  // the page body are all the stage black.
  themeColor: ui.stage,
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // Let the page reach the notch and home indicator; the shell pads with
  // the safe-area insets so nothing important sits under them.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <AppProviders>{children}</AppProviders>
        <AnalyticsGate />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
