"use client";

import { useEffect } from "react";
import { useGameStore } from "./game-store";
import { loadPersistedLobby, savePersistedLobby } from "./persistence";

export function usePersistedLobby() {
  useEffect(() => {
    const persisted = loadPersistedLobby();
    if (persisted) {
      useGameStore.setState((state) => ({
        lobby: {
          ...state.lobby,
          ...persisted.lobby,
          // Re-mount bots in case profile shape changes
          bots: persisted.lobby.bots ?? state.lobby.bots,
          extraHumans: persisted.lobby.extraHumans ?? state.lobby.extraHumans,
        },
        preferences: {
          ...state.preferences,
          ...persisted.preferences,
        },
      }));
    }

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
