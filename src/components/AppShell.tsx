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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const roomId = params.get("room");
      if (roomId) {
        setPendingRoomId(roomId);
      }
    } catch {
      // Ignore — URL parsing should never fail in normal usage
    }
  }, [setPendingRoomId]);

  if (screen === "landing") {
    return <Landing />;
  }
  return <Room />;
}
