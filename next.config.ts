import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Next 16 blocks cross-origin dev resource requests (HMR, etc.) by
  // default. Playwright connects via 127.0.0.1 in CI; allowing it here
  // keeps hydration working so e2e clicks attach.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
