"use client";

const STORAGE_KEY = "jeopardy.identity.v1";

export interface PlayerIdentity {
  /**
   * Stable per-browser id. It is the seat a shared room hands back after a
   * refresh, so scores and the host badge survive a reload.
   */
  playerId: string;
}

function randomId(): string {
  const cryptoRef = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoRef?.randomUUID) {
    return `p-${cryptoRef.randomUUID().slice(0, 8)}`;
  }
  return `p-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadIdentity(): PlayerIdentity {
  if (typeof window === "undefined") {
    return { playerId: "you" };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlayerIdentity;
      if (parsed?.playerId) return parsed;
    }
  } catch {
    // Private mode or a corrupt entry — fall through and mint a new id.
  }
  const identity: PlayerIdentity = { playerId: randomId() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Non-persistent identity is still usable for this tab.
  }
  return identity;
}
