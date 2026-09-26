"use client";

import { useSyncExternalStore } from "react";
import { reducedMotionQuery, shouldReduceMotion } from "@/lib/foundation/motion";
import { useGameStore } from "@/lib/state/game-store";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function osPrefersReduced() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(reducedMotionQuery).matches;
}

/** Whether the OS asks for reduced motion, live. `false` during SSR. */
export function useOsPrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, osPrefersReduced, () => false);
}

/**
 * Whether JS-driven animation should be skipped: the OS asks for reduced
 * motion, or the in-app switch is on. Use this instead of reading
 * `preferences.reducedMotion` alone.
 */
export function useReducedMotion(): boolean {
  const appSetting = useGameStore((s) => s.preferences.reducedMotion);
  return shouldReduceMotion(useOsPrefersReducedMotion(), appSetting);
}
