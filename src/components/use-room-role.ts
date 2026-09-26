"use client";

import { useGameStore } from "@/lib/state/game-store";

/**
 * Who this tab is in the room, for the entry tools that change the board.
 *
 * The room's snapshot names its host; with no snapshot yet (the landing
 * page, a board still being dealt) this tab is the one about to host.
 */
export function useRoomRole() {
  const publicState = useGameStore((s) => s.publicState);
  const runtime = useGameStore((s) => s.runtime);
  const screen = useGameStore((s) => s.screen);
  const selfId = useGameStore((s) => s.selfId)();
  const hostId = publicState?.settings.hostId;
  const isRoomHost = !hostId || hostId === selfId;
  const round = publicState?.round;
  /** A game is running with scores to lose: not the lobby, not the results. */
  const inGame = Boolean(
    screen !== "landing" && runtime && round && round !== "lobby" && round !== "complete",
  );
  return { isRoomHost, inGame, onLanding: screen === "landing" };
}
