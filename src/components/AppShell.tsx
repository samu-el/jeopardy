"use client";

import { useEffect } from "react";
import { useGameStore } from "@/lib/state/game-store";
import { usePersistedLobby } from "@/lib/state/use-persisted-lobby";
import { DisplayView } from "./DisplayView";
import { Landing } from "./Landing";
import { Room } from "./Room";

export function AppShell() {
  usePersistedLobby();
  const screen = useGameStore((s) => s.screen);
  const displayMode = useGameStore((s) => s.displayMode);
  const setPendingRoomId = useGameStore((s) => s.setPendingRoomId);
  const loadPublishedGame = useGameStore((s) => s.loadPublishedGame);
  const joinAsDisplay = useGameStore((s) => s.joinAsDisplay);

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
      if (!roomId) return;
      if (params.get("display") === "1") {
        // A television should show the board, not a form. Connect straight
        // away as a spectator rather than asking for a name first.
        void joinAsDisplay(roomId);
        return;
      }
      setPendingRoomId(roomId);
    } catch {
      // Ignore — URL parsing should never fail in normal usage
    }
  }, [joinAsDisplay, loadPublishedGame, setPendingRoomId]);

  if (displayMode) {
    return <DisplayView />;
  }
  if (screen === "landing") {
    return <Landing />;
  }
  return <Room />;
}
