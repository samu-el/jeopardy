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
      <head>
        {/*
          Board type. The show's own faces aren't licensable here, so these
          are the closest webfonts; the stacks in `jeopardy-style.ts` fall
          back to system fonts if the request is blocked.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router: this head is the document head. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Bitter:wght@600;700&display=swap"
        />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
        <AnalyticsGate />
      </body>
    </html>
  );
}
