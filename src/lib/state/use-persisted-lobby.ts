"use client";

import { useEffect } from "react";
import { useGameStore } from "./game-store";
import { loadIdentity } from "./identity";
import { loadPersistedLobby, savePersistedLobby } from "./persistence";

export function usePersistedLobby() {
  useEffect(() => {
    const persisted = loadPersistedLobby();
    // The browser-scoped id is the seat a shared room hands back after a
    // refresh, so it always wins over whatever the lobby snapshot stored.
    const { playerId } = loadIdentity();
    useGameStore.setState((state) => ({
      lobby: {
        ...state.lobby,
        ...(persisted?.lobby ?? {}),
        hostId: playerId,
        bots: persisted?.lobby.bots ?? state.lobby.bots,
        extraHumans: persisted?.lobby.extraHumans ?? state.lobby.extraHumans,
      },
      preferences: {
        ...state.preferences,
        ...(persisted?.preferences ?? {}),
      },
    }));

    const unsubscribe = useGameStore.subscribe((state, prev) => {
      if (
        state.lobby === prev.lobby &&
        state.preferences === prev.preferences
      ) {
        return;
      }
      savePersistedLobby({
        lobby: { ...state.lobby, customGame: undefined, customIssues: [] },
        preferences: state.preferences,
      });
    });

    return () => unsubscribe();
  }, []);
}
