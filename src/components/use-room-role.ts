"use client";

import { useGameStore } from "@/lib/state/game-store";
import { selectCanHost } from "@/lib/state/selectors";

/**
 * Who this tab is in the room, for the entry tools that change the board.
 * Host authority comes from the shared selector, so the picker, the builder
 * and Settings agree with the toolbar about who may change things.
 */
export function useRoomRole() {
  const isRoomHost = useGameStore(selectCanHost);
  const runtime = useGameStore((s) => s.runtime);
  const screen = useGameStore((s) => s.screen);
  const round = useGameStore((s) => s.publicState?.round);
  /** A game is running with scores to lose: not the lobby, not the results. */
  const inGame = Boolean(
    screen !== "landing" && runtime && round && round !== "lobby" && round !== "complete",
  );
  return { isRoomHost, inGame, onLanding: screen === "landing" };
}
