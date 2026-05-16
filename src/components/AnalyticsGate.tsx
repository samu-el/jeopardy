"use client";

import { useEffect } from "react";

/**
 * Vercel Analytics — free tier, gated behind NEXT_PUBLIC_ANALYTICS=1. When
 * the env flag is off (default) this renders nothing and never imports the
 * package. When on, the Analytics component is loaded dynamically.
 *
 * No code change required to opt in: set NEXT_PUBLIC_ANALYTICS=1 in
 * .env.local or your Vercel project. Drop the env to disable.
 */
export function AnalyticsGate() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ANALYTICS !== "1") return;
    let mounted = true;
    // The dependency is optional — kept out of static analysis so the
    // project builds without it. To opt in: `bun add @vercel/analytics`
    // and set NEXT_PUBLIC_ANALYTICS=1.
    const moduleName = "@vercel/analytics";
    (Function("name", "return import(name)")(moduleName) as Promise<unknown>)
      .then((mod) => {
        if (!mounted) return;
        const injector = (mod as { inject?: (options: object) => void }).inject;
        injector?.({ mode: "production" });
      })
      .catch(() => {
        // Package not installed — silently ignore.
      });
    return () => {
      mounted = false;
    };
  }, []);
  return null;
}
