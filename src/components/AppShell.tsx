"use client";

import { useGameStore } from "@/lib/state/game-store";
import { usePersistedLobby } from "@/lib/state/use-persisted-lobby";
import { Landing } from "./Landing";
import { Room } from "./Room";

export function AppShell() {
  usePersistedLobby();
  const screen = useGameStore((s) => s.screen);

  if (screen === "landing") {
    return <Landing />;
  }
  return <Room />;
}
