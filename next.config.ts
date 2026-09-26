import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Next 16 blocks cross-origin dev resource requests (HMR, etc.) by
  // default. Playwright connects via 127.0.0.1 in CI; allowing it here
  // keeps hydration working so e2e clicks attach.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // The dev "N" badge sits bottom-left, on top of the lectern and the
  // landing copy on every phone. Build errors still show in the overlay.
  devIndicators: false,
  async headers() {
    return [
      {
        // The service worker must never be served stale, or a fix to it
        // would take a day (the HTTP cache) to reach anyone.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};

export default nextConfig;
