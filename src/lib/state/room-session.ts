"use client";

import type { GameClue } from "@/lib/game";
import {
  LocalRoomRuntime,
  NetworkRoomRuntime,
  type ChatMessage,
  type RoomRuntime,
} from "@/lib/runtime";
import { normalizeArchivedEpisode } from "@/lib/data";
import type { GameStoreState, LobbyConfig } from "./game-store";

type StoreSet = (
  partial: Partial<GameStoreState> | ((state: GameStoreState) => Partial<GameStoreState>),
) => void;
type StoreGet = () => GameStoreState;

/**
 * Where to ask whether a room code is live. Rooms are Durable Objects on the
 * Cloudflare Worker in production; with no worker configured (local dev
 * without one) there is nothing to ask, and the socket answers instead.
 */
export function roomLookupUrl(code: string): string {
  const base = (process.env.NEXT_PUBLIC_ROOMS_URL ?? "").trim();
  const origin = base
    ? base.replace(/^ws:/, "http:").replace(/^wss:/, "https:").replace(/\/$/, "")
    : "";
  return `${origin}/room/${encodeURIComponent(code)}`;
}

/** The clue set the lobby currently has staged, from an episode or a build. */
export function resolveClues(lobby: LobbyConfig): GameClue[] {
  if (lobby.customGame) return lobby.customGame.clues;
  if (!lobby.loadedEpisode) return [];
  const normalized = normalizeArchivedEpisode(lobby.loadedEpisode.episode, {
    id: lobby.loadedEpisode.id,
    title: lobby.loadedEpisode.title,
  });
  return normalized.ok ? normalized.game.clues : [];
}

/**
 * "You" is fine on your own screen and useless when three people share a
 * board, so an unnamed player gets something the room can tell apart.
 *
 * Exported because the join card shows it: a field that reads "You" while
 * the room calls you "Player 4B2" is a name you think you chose.
 */
export function defaultPlayerName(hostId: string): string {
  return `Player ${hostId.replace(/^p-/, "").slice(0, 3).toUpperCase()}`;
}

/** The name this client will actually appear under. */
export function resolvePlayerName(name: string, hostId: string): string {
  const trimmed = name.trim();
  return trimmed && trimmed !== "You" ? trimmed : defaultPlayerName(hostId);
}

/** Chat is capped and de-duplicated in one place: a replayed frame is not a new line. */
function appendChat(existing: ChatMessage[], message: ChatMessage): ChatMessage[] {
  const merged = [...existing, message];
  return merged
    .filter((entry, index) => merged.findIndex((other) => other.id === entry.id) === index)
    .slice(-200);
}

/** The three things every room runtime reports back, wired to the store once. */
function storeListeners(set: StoreSet) {
  return {
    onPublicState: (publicState: GameStoreState["publicState"]) => set({ publicState }),
    onEvents: (lastEvents: GameStoreState["lastEvents"]) => set({ lastEvents }),
    onChat: (message: ChatMessage) =>
      set((state) => ({ chat: appendChat(state.chat, message) })),
  };
}

/**
 * Deal the board into a room that already exists: the clues, the settings
 * this lobby chose, the bots that aren't seated yet, then go.
 *
 * Both paths into a game run this — the one that opens a fresh room and the
 * one that reuses a room already on screen — and they used to be two copies
 * that drifted a setting apart.
 */
export function dealBoard(
  runtime: RoomRuntime,
  get: StoreGet,
  options: { seatBots: "all" | "missing" } = { seatBots: "all" },
) {
  const { lobby, preferences, publicState } = get();
  const clues = resolveClues(lobby);
  if (clues.length === 0) return;

  runtime.sendCommand(lobby.hostId, { type: "load-game", clues });
  runtime.sendCommand(lobby.hostId, {
    type: "update-settings",
    settings: {
      aiJudgeEnabled: lobby.aiJudgeEnabled,
      buzzWindowMs: preferences.buzzWindowSeconds * 1_000,
    },
  });

  if (runtime instanceof NetworkRoomRuntime) {
    // `load-game` keeps the players it finds, so only bots the room has never
    // seen need seating — a reconnect must not clone the whole roster.
    const seated =
      options.seatBots === "missing"
        ? new Set((publicState?.players ?? []).map((player) => player.id))
        : new Set<string>();
    for (const bot of lobby.bots.filter((candidate) => !seated.has(candidate.id))) {
      runtime.addBot({
        id: bot.id,
        displayName: bot.name,
        profileId: bot.profile.id,
        emoji: bot.emoji,
        color: bot.color,
      });
    }
  }

  runtime.sendCommand(lobby.hostId, { type: "start-game" });
}

/**
 * How long a new room may spend trying to reach the rooms service before the
 * game carries on without it.
 */
const roomConnectGraceMs = 6_000;

/**
 * Every board opens as a shared room, which means a rooms outage would
 * otherwise mean no game at all. If the socket hasn't connected by the time
 * the grace runs out, the same board reopens locally: sharing is lost, play
 * is not.
 */
export function watchForRoomFallback(set: StoreSet, get: StoreGet, roomId: string) {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    const state = get();
    // Someone else's room, a room that connected, or a game already left
    // behind — none of those are ours to replace.
    if (state.online?.roomId !== roomId || state.online.status === "connected") return;
    startLocalGame(set, get);
  }, roomConnectGraceMs);
}

/** Builds the room inside this tab. Solo play, and the offline fallback. */
export function startLocalGame(set: StoreSet, get: StoreGet) {
  const { lobby, preferences, runtime } = get();
  const clues = resolveClues(lobby);
  if (clues.length === 0) return;
  if (runtime) runtime.destroy();

  const local = new LocalRoomRuntime(
    {
      roomId: `room-${Date.now()}`,
      hostId: lobby.hostId,
      hostName: lobby.hostName,
      humanPlayers: [
        {
          id: lobby.hostId,
          name: lobby.hostName,
          spectator: lobby.hostSpectator,
          emoji: lobby.hostEmoji,
          color: lobby.hostColor,
        },
        ...lobby.extraHumans,
      ],
      bots: lobby.bots.map((bot) => ({
        id: bot.id,
        name: bot.name,
        profile: bot.profile,
        emoji: bot.emoji,
        color: bot.color,
      })),
      clues,
      settings: {
        aiJudgeEnabled: lobby.aiJudgeEnabled,
        aiBotsEnabled: lobby.bots.length > 0,
        aiAvatarHostEnabled: preferences.avatarHostMode !== "off",
        buzzWindowMs: preferences.buzzWindowSeconds * 1_000,
      },
    },
    storeListeners(set),
  );

  set({
    runtime: local,
    online: null,
    shareUnavailable: true,
    screen: "play",
    publicState: local.getPublicState(),
    chat: [],
  });

  local.sendCommand(lobby.hostId, { type: "start-game" });
}

/** Opens a socket to a shared room and points the store at it. */
export function connectToRoom(
  set: StoreSet,
  get: StoreGet,
  roomId: string,
  isHost: boolean,
) {
  const { lobby } = get();
  const displayName = resolvePlayerName(lobby.hostName, lobby.hostId);

  set({
    online: { roomId, status: "connecting", isHost },
    shareUnavailable: false,
    lobby: { ...lobby, hostName: displayName },
    publicState: null,
    chat: [],
    lastEvents: [],
    lastCue: null,
    screen: "play",
  });

  set({
    runtime: new NetworkRoomRuntime(
      {
        roomId,
        clientId: lobby.hostId,
        displayName,
        emoji: lobby.hostEmoji,
        color: lobby.hostColor,
        spectator: lobby.hostSpectator,
        create: isHost,
      },
      {
        ...storeListeners(set),
        onStatus: (status, detail) =>
          set((state) => ({
            online: state.online
              ? { ...state.online, status, error: detail ?? undefined }
              : { roomId, status, isHost, error: detail },
          })),
      },
    ),
  });
}
