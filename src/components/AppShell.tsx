"use client";

import { useEffect } from "react";
import { useGameStore } from "@/lib/state/game-store";
import { usePersistedLobby } from "@/lib/state/use-persisted-lobby";
import { Landing } from "./Landing";
import { Room } from "./Room";

export function AppShell() {
  usePersistedLobby();
  const screen = useGameStore((s) => s.screen);
  const setPendingRoomId = useGameStore((s) => s.setPendingRoomId);
  const loadPublishedGame = useGameStore((s) => s.loadPublishedGame);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const gameId = params.get("game");
      if (gameId) {
        // A shared custom game: fetch it and deal it, the same as New Game.
        void loadPublishedGame(gameId);
        return;
      }
      const roomId = params.get("room");
      if (roomId) {
        setPendingRoomId(roomId);
      }
    } catch {
      // Ignore — URL parsing should never fail in normal usage
    }
  }, [loadPublishedGame, setPendingRoomId]);

  if (screen === "landing") {
    return <Landing />;
  }
  return <Room />;
}
