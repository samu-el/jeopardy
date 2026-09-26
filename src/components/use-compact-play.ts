"use client";

import useMediaQuery from "@mui/material/useMediaQuery";

/**
 * A phone, or any screen too short for the desk layout (a phone on its side):
 * the buzzer moves to a bar pinned to the bottom of the screen, and the board
 * and clue are sized from the height actually left.
 */
export const compactPlayQuery = "(max-width:599.95px), (max-height:520px)";

export function useCompactPlay(): boolean {
  return useMediaQuery(compactPlayQuery, { noSsr: true });
}
