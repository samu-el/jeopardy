"use client";

import useMediaQuery from "@mui/material/useMediaQuery";
import { useGameStore } from "@/lib/state/game-store";

/**
 * Whether to hold still: the in-app switch, or the operating system's
 * "reduce motion" setting — either one is enough.
 */
export function useReducedMotion(): boolean {
  const preference = useGameStore((s) => s.preferences.reducedMotion);
  const system = useMediaQuery("(prefers-reduced-motion: reduce)", { noSsr: true });
  return preference || system;
}

/**
 * A phone, or any screen too short for the desk layout (a phone on its side):
 * the buzzer moves to a bar pinned to the bottom of the screen.
 */
export const compactPlayQuery = "(max-width:599.95px), (max-height:520px)";

export function useCompactPlay(): boolean {
  return useMediaQuery(compactPlayQuery, { noSsr: true });
}
