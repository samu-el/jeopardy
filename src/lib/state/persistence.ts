"use client";

import type { LobbyConfig, UiPreferences } from "./game-store";

const STORAGE_KEY = "jeopardy-modern.lobby.v1";

export interface PersistedLobby {
  lobby: LobbyConfig;
  preferences: UiPreferences;
}

export function loadPersistedLobby(): PersistedLobby | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedLobby;
    if (!parsed?.lobby || !parsed?.preferences) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePersistedLobby(data: PersistedLobby) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota / serialization issues
  }
}

export function clearPersistedLobby() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
