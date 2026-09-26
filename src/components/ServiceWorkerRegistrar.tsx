"use client";

import { useEffect } from "react";

/**
 * Registers `/sw.js` (offline page + hashed static cache) in production.
 *
 * Off in development and in the e2e run: a service worker there caches HMR
 * chunks and outlives the dev server. `NEXT_PUBLIC_SW=0` turns it off in
 * production too, and then unregisters any worker a previous build left.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const enabled = process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SW !== "0";
    if (!enabled) {
      if (process.env.NODE_ENV === "production") {
        void navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
          .catch(() => undefined);
      }
      return;
    }
    const register = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}
