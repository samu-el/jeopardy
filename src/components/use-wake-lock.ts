"use client";

import { useEffect, useRef } from "react";
import {
  browserWakeLockEnvironment,
  createWakeLockController,
  type WakeLockController,
} from "@/lib/foundation/wake-lock";

/**
 * Holds a screen wake lock while `active` is true, re-acquiring it when the
 * tab becomes visible again. A no-op where the API is missing or denied.
 */
export function useWakeLock(active: boolean) {
  const controller = useRef<WakeLockController | null>(null);

  useEffect(() => {
    const env = browserWakeLockEnvironment();
    if (!env?.wakeLock) return;
    const created = createWakeLockController(env);
    controller.current = created;
    return () => {
      created.dispose();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    controller.current?.setActive(active);
  }, [active]);
}
