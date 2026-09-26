"use client";

import type { PublicGameState } from "@/lib/game";
import { getFinalReveal, type FinalReveal } from "@/lib/game/final-reveal";
import { useGameStore } from "@/lib/state/game-store";

/**
 * The last Final Jeopardy reveal this tab saw, kept for the results screen.
 *
 * When the game completes the room drops its active clue, and the answers
 * and wagers go with it. The results screen still wants to show them, so
 * the reveal is remembered here as snapshots arrive — a view of public
 * state, not game state, and forgotten as soon as a new game starts.
 */
let remembered: { roomId: string; reveal: FinalReveal } | null = null;

function track(state: PublicGameState | null) {
  if (!state) return;
  const reveal = getFinalReveal(state);
  if (reveal && reveal.rows.length > 0) {
    remembered = { roomId: state.roomId, reveal };
  } else if (state.round !== "final-jeopardy" && state.round !== "complete") {
    remembered = null;
  }
}

if (typeof window !== "undefined") {
  track(useGameStore.getState().publicState);
  useGameStore.subscribe((store, previous) => {
    if (store.publicState !== previous.publicState) track(store.publicState);
  });
}

/** The Final reveal for a finished game, or null when this tab never saw one. */
export function lastFinalReveal(state: PublicGameState): FinalReveal | null {
  if (state.round !== "complete") return null;
  return remembered && remembered.roomId === state.roomId ? remembered.reveal : null;
}
