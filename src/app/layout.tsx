import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "./providers";
import { AnalyticsGate } from "@/components/AnalyticsGate";

export const metadata: Metadata = {
  title: "Jeopardy",
  description: "Multiplayer Jeopardy with AI bots, voice readout, and host controls.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  applicationName: "Jeopardy",
  appleWebApp: { title: "Jeopardy", capable: true, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#070a16",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
        <AnalyticsGate />
      </body>
    </html>
  );
}
