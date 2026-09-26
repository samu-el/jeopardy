"use client";

import type { GameClue } from "@/lib/game";
import {
  LocalRoomRuntime,
  NetworkRoomRuntime,
  type ChatMessage,
  type RoomProblem,
  type RoomRuntime,
} from "@/lib/runtime";
import { normalizeArchivedEpisode } from "@/lib/data";
import { generateRoomCode } from "@/lib/realtime/room-code";
import type { GameStoreState, LobbyConfig, OnlineRoomState } from "./game-store";
import { appendNotice, hostChangeNotice, noticesFromEvents, type RoomNoticeDraft } from "./notices";
import { forgetRoomSeat, recallRoomSeat, rememberRoomSeat, writeRoomToUrl } from "./room-memory";

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

export type RoomLookup = "open" | "not-found" | "unreachable";

/** How long the "is this room open?" question may take before it counts as unanswered. */
export const roomLookupTimeoutMs = 8_000;

/**
 * Asks whether a code names an open room, and tells "no such room" apart
 * from "couldn't ask". The two used to share one message, which sent people
 * chasing a fresh code during an outage.
 */
export async function lookupRoom(
  code: string,
  {
    fetchFn = fetch,
    timeoutMs = roomLookupTimeoutMs,
  }: { fetchFn?: typeof fetch; timeoutMs?: number } = {},
): Promise<RoomLookup> {
  const controller = typeof AbortController === "undefined" ? undefined : new AbortController();
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const response = await fetchFn(roomLookupUrl(code), { signal: controller?.signal });
    let body: { exists?: unknown } | undefined;
    try {
      body = (await response.json()) as { exists?: unknown };
    } catch {
      body = undefined;
    }
    if (typeof body?.exists === "boolean") return body.exists ? "open" : "not-found";
    // No answer in the body: a 404 is a lookup route with no such room behind
    // it; anything else is the service failing, not the code.
    return response.status === 404 ? "not-found" : "unreachable";
  } catch {
    return "unreachable";
  } finally {
    clearTimeout(timer);
  }
}

export function lookupMessage(code: string, result: Exclude<RoomLookup, "open">): string {
  return result === "not-found"
    ? `Room ${code} isn't open. Ask the host for a fresh code, or start your own game.`
    : "Can't reach the game server. Check your connection and try again.";
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

/**
 * A name worth telling the room about, or undefined to keep the one it has.
 * A cleared field is somebody halfway through typing, not a new name.
 */
export function committableName(name: string): string | undefined {
  const trimmed = name.trim().replace(/\s+/g, " ").slice(0, 40);
  return trimmed && trimmed !== "You" ? trimmed : undefined;
}

/** Chat is capped and de-duplicated in one place: a replayed frame is not a new line. */
function appendChat(existing: ChatMessage[], message: ChatMessage): ChatMessage[] {
  const merged = [...existing, message];
  return merged
    .filter((entry, index) => merged.findIndex((other) => other.id === entry.id) === index)
    .slice(-200);
}

export function pushNotice(set: StoreSet, draft: RoomNoticeDraft) {
  set((state) => ({ notices: appendNotice(state.notices, draft, Date.now()) }));
}

/** The three things every room runtime reports back, wired to the store once. */
function storeListeners(set: StoreSet, get: StoreGet) {
  return {
    onPublicState: (publicState: NonNullable<GameStoreState["publicState"]>) => {
      const previous = get().publicState;
      const change = hostChangeNotice(previous, publicState, get().selfId());
      set({ publicState });
      if (change) pushNotice(set, change);
    },
    onEvents: (lastEvents: GameStoreState["lastEvents"]) => {
      set({ lastEvents });
      if (!get().online) return;
      for (const draft of noticesFromEvents(lastEvents, get().selfId())) {
        pushNotice(set, draft);
      }
    },
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
 * player is offered the board offline. Offered, never imposed: the socket
 * keeps trying, and a room that answers late is still the room.
 */
export const roomConnectGraceMs = 6_000;

/**
 * If a room has never connected once the grace runs out, say so and offer to
 * play offline. This used to swap the room for a local one on its own — on a
 * blip, or when a second tab took the seat — leaving guests with a host who
 * was OFFLINE for good.
 */
export function watchForUnreachableRoom(set: StoreSet, get: StoreGet, roomId: string) {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    const online = get().online;
    if (online?.roomId !== roomId || online.everConnected || online.status === "rejected") return;
    set({
      online: {
        ...online,
        problem: "unreachable",
        error: "Can't reach the rooms service. Still trying…",
      },
    });
  }, roomConnectGraceMs);
}

/** Builds the room inside this tab. Solo play, and offline play when asked for. */
export function startLocalGame(set: StoreSet, get: StoreGet) {
  const { lobby, preferences, runtime } = get();
  const clues = resolveClues(lobby);
  if (clues.length === 0) return;
  if (runtime) runtime.destroy();
  connectAttempt += 1;

  const local = new LocalRoomRuntime(
    {
      roomId: `room-${Date.now()}`,
      hostId: lobby.hostId,
      hostName: lobby.hostName,
      humanPlayers: [
        {
          id: lobby.hostId,
          name: resolvePlayerName(lobby.hostName, lobby.hostId),
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
    storeListeners(set, get),
  );

  writeRoomToUrl(null);
  set({
    runtime: local,
    online: null,
    shareUnavailable: true,
    screen: "play",
    publicState: local.getPublicState(),
    chat: [],
    notices: [],
  });

  local.sendCommand(lobby.hostId, { type: "start-game" });
}

export interface ConnectOptions {
  /** This client is opening the room (asks the server to create it). */
  create: boolean;
  /** A display joins under its own id and name and never touches the lobby. */
  role: OnlineRoomState["role"];
  clientId?: string;
  displayName?: string;
  spectator?: boolean;
}

/**
 * Bumped by every connect and every local game, so a runtime that has been
 * replaced can't write its late status over the one that replaced it.
 */
let connectAttempt = 0;

/** Rolls another code this many times before giving up on a collision. */
const maxCodeAttempts = 5;

/** Opens a socket to a shared room and points the store at it. */
export function connectToRoom(
  set: StoreSet,
  get: StoreGet,
  roomId: string,
  options: ConnectOptions,
) {
  const { lobby, runtime: previous } = get();
  if (previous) previous.destroy();
  const attempt = ++connectAttempt;
  const isDisplay = options.role === "display";
  const clientId = options.clientId ?? lobby.hostId;
  const displayName =
    options.displayName ?? resolvePlayerName(lobby.hostName, lobby.hostId);
  const remembered = recallRoomSeat(roomId, clientId);

  set({
    online: {
      roomId,
      status: "connecting",
      isHost: options.create || Boolean(remembered?.host),
      role: options.role,
      everConnected: false,
    },
    shareUnavailable: false,
    // A display's name is its own business: it never lands in the lobby a
    // browser persists, or every later game would start as "Display".
    ...(isDisplay ? {} : { lobby: { ...lobby, hostName: displayName } }),
    publicState: null,
    chat: [],
    notices: [],
    lastEvents: [],
    lastCue: null,
    screen: "play",
  });

  const current = () => attempt === connectAttempt;

  const runtime = new NetworkRoomRuntime(
    {
      roomId,
      clientId,
      displayName,
      emoji: isDisplay ? undefined : lobby.hostEmoji,
      color: isDisplay ? undefined : lobby.hostColor,
      spectator: options.spectator ?? (isDisplay ? true : lobby.hostSpectator),
      create: options.create,
      sessionToken: remembered?.sessionToken,
    },
    {
      ...storeListeners(set, get),
      onSession: (sessionToken) => {
        if (!current()) return;
        rememberRoomSeat({
          roomId,
          clientId,
          sessionToken,
          host: options.create || undefined,
        });
        // The address bar now names the room, so a refresh comes back to it.
        if (!isDisplay) writeRoomToUrl(roomId);
      },
      onRefused: (reason, message) => {
        if (!current()) return;
        if (reason === "not-authorized" || reason === "room-full") {
          pushNotice(set, { kind: reason === "room-full" ? "room-full" : "refused", text: message });
        }
      },
      onStatus: (status, detail, problem) => {
        if (!current()) return;
        if (status === "rejected" && problem === "code-taken" && options.create) {
          retryWithFreshCode(set, get, options);
          return;
        }
        if (status === "rejected" && (problem === "kicked" || problem === "invalid-session")) {
          forgetRoomSeat(roomId, clientId);
        }
        if (status === "rejected" && problem === "kicked") {
          pushNotice(set, { kind: "kicked", text: detail ?? "The host removed you from this room." });
        }
        if (status === "rejected" && problem === "full") {
          pushNotice(set, { kind: "room-full", text: detail ?? "This room is full." });
        }
        set((state) => {
          const base: OnlineRoomState = state.online ?? {
            roomId,
            status,
            isHost: options.create,
            role: options.role,
            everConnected: false,
          };
          const connected = status === "connected";
          return {
            online: {
              ...base,
              status,
              everConnected: base.everConnected || connected,
              // A problem sticks until the room is live again: "still
              // unreachable" survives each retry's "connecting".
              problem: connected ? undefined : (problem ?? base.problem),
              error: connected ? undefined : (detail ?? base.error),
            },
          };
        });
      },
    },
  );
  set({ runtime });
  return runtime;
}

/**
 * Opens a fresh room for the lobby's board: mint a code, connect with
 * `create`, deal. The frames queue until the socket opens.
 */
export function openHostedRoom(set: StoreSet, get: StoreGet, codeAttempt = 1) {
  const roomId = generateRoomCode();
  const runtime = connectToRoom(set, get, roomId, { create: true, role: "player" });
  codeAttempts.set(runtime, codeAttempt);
  dealBoard(runtime, get);
  watchForUnreachableRoom(set, get, roomId);
}

const codeAttempts = new WeakMap<RoomRuntime, number>();

function retryWithFreshCode(set: StoreSet, get: StoreGet, options: ConnectOptions) {
  const runtime = get().runtime;
  const attempt = (runtime ? codeAttempts.get(runtime) : undefined) ?? 1;
  if (attempt >= maxCodeAttempts || !options.create) {
    set((state) => ({
      online: state.online
        ? {
            ...state.online,
            status: "rejected",
            problem: "code-taken",
            error: "Couldn't find a free room code. Try again in a moment.",
          }
        : null,
    }));
    return;
  }
  openHostedRoom(set, get, attempt + 1);
}

/** Problems that a fresh attempt might fix, as opposed to a decision the room made. */
export function isRetryableProblem(problem: RoomProblem | undefined): boolean {
  return problem === "not-found" || problem === "unreachable";
}
