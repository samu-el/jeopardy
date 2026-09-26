"use client";

import type { GameStoreState } from "./game-store";

/**
 * Read-only views of the store that the UI branches on. Components should ask
 * these rather than re-deriving "am I the host?" from `publicState` and
 * `lobby` in each place — that re-derivation is how guests ended up with
 * controls that did nothing.
 *
 * Every selector is a plain function of the store, usable as
 * `useGameStore(selectCanHost)` or against `useGameStore.getState()`.
 */

/**
 * May this client run the room: deal, restart, change the game, seat bots,
 * change settings, hand the chair over?
 *
 * Solo play is always yours. In a shared room the room's own state decides;
 * before the first snapshot arrives, only the browser that opened the room
 * gets the benefit of the doubt. The room enforces all of this anyway —
 * this is so the UI can hide or disable what would be refused.
 */
export function selectCanHost(state: GameStoreState): boolean {
  const { online, publicState } = state;
  if (!online) return true;
  if (!publicState) return online.isHost && online.role === "player";
  const hostId = publicState.settings.hostId;
  return !hostId || hostId === state.selfId();
}

export type RoomRole = "host" | "player" | "spectator" | "display";

/** What this client is in the room it is looking at. */
export function selectRole(state: GameStoreState): RoomRole {
  if (state.online?.role === "display") return "display";
  if (selectCanHost(state)) return "host";
  const selfId = state.selfId();
  const self = state.publicState?.players.find((player) => player.id === selfId);
  return self?.spectator ? "spectator" : "player";
}

export type RoomStatusView =
  /** No room at all (landing page, nothing dealt). */
  | "idle"
  /** Playing in this tab only: solo, or offline by choice. */
  | "local"
  | "connecting"
  | "connected"
  /** Was in, lost the connection, trying again. The seat is held. */
  | "reconnecting"
  /** Never got through to the rooms service (still trying). */
  | "unreachable"
  /** The code names no open room. */
  | "not-found"
  | "full"
  | "kicked"
  /** Another tab of this browser took the seat. */
  | "replaced"
  | "code-taken"
  | "invalid-session"
  | "rejected";

/**
 * One word for where this client stands with its room. A television on a
 * dead code reads "not-found"; a blip reads "reconnecting".
 */
export function selectRoomStatus(state: GameStoreState): RoomStatusView {
  const { online } = state;
  if (!online) return state.runtime ? "local" : "idle";
  if (online.status === "connected") return "connected";
  if (online.status === "local") return "local";
  if (online.status === "rejected") return online.problem ?? "rejected";
  if (online.problem === "unreachable") return "unreachable";
  return online.everConnected ? "reconnecting" : "connecting";
}

/** The connection dropped after the room had let us in: the board should wait. */
export function selectIsReconnecting(state: GameStoreState): boolean {
  return selectRoomStatus(state) === "reconnecting";
}

/**
 * Whether input to the board should be taken at all. False while a shared
 * room is not live, so a pick or a buzz can't be made against a board the
 * room has since moved on from.
 */
export function selectRoomInteractive(state: GameStoreState): boolean {
  return !state.online || state.online.status === "connected";
}

/** A game is on (clues in play), as opposed to a lobby or a results screen. */
export function selectIsLiveGame(state: GameStoreState): boolean {
  const round = state.publicState?.round;
  return Boolean(round && round !== "lobby" && round !== "complete");
}

/** The room's transient notices, oldest first. */
export function selectNotices(state: GameStoreState) {
  return state.notices;
}
