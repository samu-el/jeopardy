"use client";

import { create } from "zustand";
import type { BotProfile } from "@/lib/foundation/game-contracts";
import type { GameClue, GameEvent, PublicGameState } from "@/lib/game";
import {
  LocalRoomRuntime,
  NetworkRoomRuntime,
  type ChatMessage,
  type RoomConnectionStatus,
  type RoomRuntime,
} from "@/lib/runtime";
import {
  fetchPublishedGame,
  publishedGameToNormalized,
  fetchRandomEpisode,
  normalizeArchivedEpisode,
  type ArchivedEpisodeInput,
  type BuilderGame,
  type GameDataIssue,
  type NormalizedGame,
} from "@/lib/data";
import { defaultAvatarHostProfile, type AvatarHostCue } from "@/lib/ai";
import { generateRoomCode, normalizeRoomCode } from "@/lib/realtime/room-code";

/**
 * Where to ask whether a room code is live. Rooms are Durable Objects on the
 * Cloudflare Worker in production; with no worker configured (local dev
 * without one) there is nothing to ask, and the socket answers instead.
 */
function roomLookupUrl(code: string): string {
  const base = (process.env.NEXT_PUBLIC_ROOMS_URL ?? "").trim();
  const origin = base
    ? base.replace(/^ws:/, "http:").replace(/^wss:/, "https:").replace(/\/$/, "")
    : "";
  return `${origin}/room/${encodeURIComponent(code)}`;
}

export type ScreenName = "landing" | "play" | "results";

export interface UiPreferences {
  reducedMotion: boolean;
  soundEnabled: boolean;
  /** The host's line, printed on screen. Off unless it is asked for. */
  subtitlesEnabled: boolean;
  voiceProfileId: string;
  avatarHostProfileId: string;
  avatarHostMode: "off" | "voice-only" | "avatar-and-voice";
  /**
   * How long the buzzer stays open after the readout, in seconds. The show
   * runs tight; a longer window helps a mixed table or a slow connection.
   */
  buzzWindowSeconds: number;
}

export interface LobbyBotConfig {
  id: string;
  name: string;
  profile: BotProfile;
  emoji?: string;
  color?: string;
}

export interface LobbyHumanConfig {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
}

export interface LoadedEpisode {
  id: string;
  title: string;
  airDate?: string;
  info?: string;
  episode: ArchivedEpisodeInput;
}

export interface LobbyConfig {
  hostName: string;
  hostId: string;
  hostEmoji?: string;
  hostColor?: string;
  hostSpectator?: boolean;
  loadedEpisode?: LoadedEpisode;
  customGame?: NormalizedGame;
  customIssues: GameDataIssue[];
  bots: LobbyBotConfig[];
  extraHumans: LobbyHumanConfig[];
  aiJudgeEnabled: boolean;
  hostControlsAuto: boolean;
  builderDraft?: BuilderGame;
  soloMode: boolean;
}

export interface OnlineRoomState {
  roomId: string;
  status: RoomConnectionStatus;
  isHost: boolean;
  error?: string;
}

export interface GameStoreState {
  screen: ScreenName;
  preferences: UiPreferences;
  lobby: LobbyConfig;
  chat: ChatMessage[];
  publicState: PublicGameState | null;
  runtime: RoomRuntime | null;
  /** Non-null while this tab is in a shared (server-hosted) room. */
  online: OnlineRoomState | null;
  /**
   * True when a board is running locally because the rooms service could not
   * be reached, so the UI can say the code isn't coming rather than showing a
   * code nobody else can join.
   */
  shareUnavailable: boolean;
  /**
   * This tab is a display: a spectator view meant for a television, with the
   * board large and the join code readable across the room.
   */
  displayMode: boolean;
  setDisplayMode: (on: boolean) => void;
  /** Joins a room as a display — no seat, no buzzer, no name to type. */
  joinAsDisplay: (roomId: string) => Promise<boolean>;
  lastEvents: GameEvent[];
  lastCue: AvatarHostCue | null;
  /**
   * Set when the app is opened with ?room=<id>. The landing page shows
   * the join flow when this is non-null.
   */
  pendingRoomId: string | null;
  setPendingRoomId: (id: string | null) => void;
  /** The player id this client acts as — the seat, not the room owner. */
  selfId: () => string;
  joinOnlineRoom: (roomId: string) => Promise<boolean>;
  leaveOnlineRoom: () => void;
  pushLoadedGameToRoom: () => void;
  /** Pulls a random board from the archive and deals it straight away. */
  startRandomGame: () => Promise<{ ok: boolean; error?: string }>;
  /** Loads a published custom game by id and stages it to play. */
  loadPublishedGame: (id: string) => Promise<{ ok: boolean; error?: string }>;
  setScreen: (screen: ScreenName) => void;
  setHostName: (name: string) => void;
  setPlayerAvatar: (
    id: string,
    avatar: { emoji?: string | null; color?: string | null },
  ) => void;
  setLoadedEpisode: (loaded: LoadedEpisode | undefined) => void;
  setCustomGame: (game: NormalizedGame | undefined, issues: GameDataIssue[]) => void;
  addBot: (profile: BotProfile) => void;
  removeBot: (id: string) => void;
  renameBot: (id: string, name: string) => void;
  addHuman: (name: string) => void;
  removeHuman: (id: string) => void;
  setAiJudge: (enabled: boolean) => void;
  setHostControlsAuto: (auto: boolean) => void;
  saveBuilderDraft: (draft: BuilderGame) => void;
  setSoloMode: (solo: boolean) => void;
  setHostSpectator: (spectator: boolean) => void;
  setPreference: <K extends keyof UiPreferences>(key: K, value: UiPreferences[K]) => void;
  startGame: () => void;
  exitToLobby: () => void;
  setPublicState: (state: PublicGameState) => void;
  setLastEvents: (events: GameEvent[]) => void;
  setLastCue: (cue: AvatarHostCue) => void;
  appendChat: (message: ChatMessage) => void;
}

const initialBots: LobbyBotConfig[] = [];

const stableHostId = "you";

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  screen: "landing",
  preferences: {
    reducedMotion: false,
    // A board that starts talking on its own is worse than a quiet one:
    // both the voice and its on-screen line wait to be switched on.
    soundEnabled: false,
    subtitlesEnabled: false,
    voiceProfileId: "female-natural",
    avatarHostProfileId: defaultAvatarHostProfile().id,
    avatarHostMode: "voice-only",
    buzzWindowSeconds: 6,
  },
  lobby: {
    hostName: "You",
    hostId: stableHostId,
    customIssues: [],
    bots: initialBots,
    extraHumans: [],
    aiJudgeEnabled: true,
    hostControlsAuto: true,
    soloMode: false,
  },
  chat: [],
  publicState: null,
  runtime: null,
  online: null,
  shareUnavailable: false,
  displayMode: false,
  lastEvents: [],
  lastCue: null,
  pendingRoomId: null,
  setPendingRoomId: (id) => set({ pendingRoomId: id }),
  selfId: () => {
    const { runtime, lobby } = get();
    return runtime?.selfId ?? lobby.hostId;
  },
  setScreen: (screen) => set({ screen }),
  setHostName: (name) => {
    const trimmed = name.trim() || "You";
    set((state) => ({ lobby: { ...state.lobby, hostName: trimmed } }));
    const { runtime, online, lobby } = get();
    if (runtime && online) {
      runtime.sendCommand(lobby.hostId, {
        type: "set-player-profile",
        displayName: trimmed,
      });
    }
  },
  setPlayerAvatar: (id, avatar) =>
    set((state) => {
      const patch = (
        existing: { emoji?: string; color?: string } | undefined,
      ): { emoji?: string; color?: string } => ({
        emoji:
          avatar.emoji === undefined
            ? existing?.emoji
            : avatar.emoji === null
              ? undefined
              : avatar.emoji,
        color:
          avatar.color === undefined
            ? existing?.color
            : avatar.color === null
              ? undefined
              : avatar.color,
      });
      if (id === state.lobby.hostId) {
        const next = patch({ emoji: state.lobby.hostEmoji, color: state.lobby.hostColor });
        const { runtime, online } = get();
        if (runtime && online) {
          runtime.sendCommand(id, {
            type: "set-player-profile",
            emoji: next.emoji,
            color: next.color,
          });
        }
        return {
          lobby: { ...state.lobby, hostEmoji: next.emoji, hostColor: next.color },
        };
      }
      return {
        lobby: {
          ...state.lobby,
          bots: state.lobby.bots.map((bot) => {
            if (bot.id !== id) return bot;
            const next = patch({ emoji: bot.emoji, color: bot.color });
            return { ...bot, emoji: next.emoji, color: next.color };
          }),
          extraHumans: state.lobby.extraHumans.map((human) => {
            if (human.id !== id) return human;
            const next = patch({ emoji: human.emoji, color: human.color });
            return { ...human, emoji: next.emoji, color: next.color };
          }),
        },
      };
    }),
  setLoadedEpisode: (loaded) => {
    const { runtime, online } = get();
    // Staging a different board must never drop a shared room: the host
    // pushes it to the server on Begin instead.
    if (runtime && !online) runtime.destroy();
    set((state) => ({
      runtime: online ? state.runtime : null,
      publicState: online ? state.publicState : null,
      chat: online ? state.chat : [],
      lastEvents: online ? state.lastEvents : [],
      lastCue: online ? state.lastCue : null,
      lobby: {
        ...state.lobby,
        loadedEpisode: loaded,
        customGame: loaded ? undefined : state.lobby.customGame,
      },
    }));
  },
  setCustomGame: (game, issues) => {
    const { runtime, online } = get();
    const reset = Boolean(game) && !online;
    if (runtime && reset) runtime.destroy();
    set((state) => ({
      runtime: reset ? null : state.runtime,
      publicState: reset ? null : state.publicState,
      chat: reset ? [] : state.chat,
      lastEvents: reset ? [] : state.lastEvents,
      lastCue: reset ? null : state.lastCue,
      lobby: {
        ...state.lobby,
        customGame: game,
        customIssues: issues,
        loadedEpisode: game ? undefined : state.lobby.loadedEpisode,
      },
    }));
  },
  addBot: (profile) => {
    const state = get();
    const bot = {
      id: makeId("bot"),
      name: `${profile.label} #${state.lobby.bots.length + 1}`,
      profile,
    };
    set({ lobby: { ...state.lobby, bots: [...state.lobby.bots, bot] } });
    // In a shared room the bot has to exist on the server to play at all.
    if (state.online && state.runtime instanceof NetworkRoomRuntime) {
      state.runtime.addBot({
        id: bot.id,
        displayName: bot.name,
        profileId: profile.id,
      });
    }
  },
  removeBot: (id) => {
    const { online, runtime, lobby } = get();
    if (online && runtime) {
      runtime.sendCommand(lobby.hostId, { type: "leave-game", targetPlayerId: id });
    }
    set((state) => ({
      lobby: {
        ...state.lobby,
        bots: state.lobby.bots.filter((bot) => bot.id !== id),
      },
    }));
  },
  renameBot: (id, name) =>
    set((state) => ({
      lobby: {
        ...state.lobby,
        bots: state.lobby.bots.map((bot) =>
          bot.id === id ? { ...bot, name: name.trim() || bot.profile.label } : bot,
        ),
      },
    })),
  addHuman: (name) =>
    set((state) => ({
      lobby: {
        ...state.lobby,
        extraHumans: [
          ...state.lobby.extraHumans,
          { id: makeId("human"), name: name.trim() || "Guest" },
        ],
      },
    })),
  removeHuman: (id) =>
    set((state) => ({
      lobby: {
        ...state.lobby,
        extraHumans: state.lobby.extraHumans.filter((player) => player.id !== id),
      },
    })),
  setAiJudge: (enabled) =>
    set((state) => ({
      lobby: { ...state.lobby, aiJudgeEnabled: enabled },
    })),
  setHostControlsAuto: (auto) =>
    set((state) => ({
      lobby: { ...state.lobby, hostControlsAuto: auto },
    })),
  saveBuilderDraft: (draft) =>
    set((state) => ({
      lobby: { ...state.lobby, builderDraft: draft },
    })),
  setSoloMode: (solo) =>
    set((state) => ({
      lobby: { ...state.lobby, soloMode: solo },
    })),
  setHostSpectator: (spectator) => {
    set((state) => ({ lobby: { ...state.lobby, hostSpectator: spectator } }));
    const { runtime, online, lobby } = get();
    if (runtime && online) {
      runtime.sendCommand(lobby.hostId, { type: "set-player-profile", spectator });
    }
  },
  setPreference: (key, value) => {
    set((state) => ({ preferences: { ...state.preferences, [key]: value } }));
    if (key === "buzzWindowSeconds") {
      const { runtime, lobby, publicState } = get();
      const isHost = !publicState?.settings.hostId || publicState.settings.hostId === lobby.hostId;
      if (runtime && isHost) {
        runtime.sendCommand(lobby.hostId, {
          type: "update-settings",
          settings: { buzzWindowMs: Number(value) * 1_000 },
        });
      }
    }
  },
  setDisplayMode: (on) => set({ displayMode: on }),
  joinAsDisplay: async (roomId) => {
    // A display takes no seat, so it joins as a spectator under a name the
    // roster can show without anyone typing one on a television.
    set((state) => ({
      displayMode: true,
      lobby: { ...state.lobby, hostSpectator: true, hostName: "Display" },
    }));
    return get().joinOnlineRoom(roomId);
  },
  joinOnlineRoom: async (roomId) => {
    const { runtime } = get();
    if (runtime) runtime.destroy();
    set({ runtime: null, publicState: null, chat: [], lastEvents: [], lastCue: null });
    const normalized = normalizeRoomCode(roomId);
    try {
      const response = await fetch(roomLookupUrl(normalized));
      const exists = response.ok && ((await response.json()) as { exists?: boolean }).exists;
      if (!exists) {
        set({
          online: {
            roomId: normalized,
            status: "rejected",
            isHost: false,
            error: "That room is not open. Ask the host for a fresh code.",
          },
        });
        return false;
      }
    } catch (error) {
      set({
        online: {
          roomId: normalized,
          status: "rejected",
          isHost: false,
          error: (error as Error).message,
        },
      });
      return false;
    }
    connectToRoom(set, get, normalized, false);
    return true;
  },
  leaveOnlineRoom: () => {
    const { runtime, online, lobby } = get();
    if (runtime && online) {
      // Give the seat back explicitly — a dropped socket mid-game is held
      // open for a reconnect, which isn't what "leave" means.
      runtime.sendCommand(lobby.hostId, { type: "leave-game" });
    }
    if (runtime) runtime.destroy();
    set({
      runtime: null,
      online: null,
      publicState: null,
      chat: [],
      lastEvents: [],
      lastCue: null,
      screen: "play",
    });
  },
  pushLoadedGameToRoom: () => {
    const { runtime, lobby } = get();
    const clues = resolveClues(lobby);
    if (!runtime || clues.length === 0) return;
    runtime.sendCommand(lobby.hostId, { type: "load-game", clues });
  },
  startRandomGame: async () => {
    try {
      const response = await fetchRandomEpisode();
      get().setLoadedEpisode({
        id: response.id,
        title: response.episode.title ?? `Episode ${response.id}`,
        airDate: response.episode.airDate,
        info: response.episode.info,
        episode: response.episode,
      });
      get().startGame();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          (error as Error).message ||
          "Could not reach the episode archive. Try again in a moment.",
      };
    }
  },
  loadPublishedGame: async (id) => {
    const game = await fetchPublishedGame(id);
    if (!game) {
      return { ok: false, error: "That game link is not valid any more." };
    }
    get().setCustomGame(publishedGameToNormalized(game), []);
    get().startGame();
    return { ok: true };
  },
  startGame: () => {
    const { lobby, runtime, online } = get();
    const clues = resolveClues(lobby);
    if (clues.length === 0) {
      return;
    }

    if (online && runtime) {
      // The room already exists on the server: load the board, then start.
      runtime.sendCommand(lobby.hostId, { type: "load-game", clues });
      runtime.sendCommand(lobby.hostId, {
        type: "update-settings",
        settings: {
          aiJudgeEnabled: lobby.aiJudgeEnabled,
          buzzWindowMs: get().preferences.buzzWindowSeconds * 1_000,
        },
      });
      if (runtime instanceof NetworkRoomRuntime) {
        // Re-assert the bot roster: load-game keeps players, and a bot added
        // before this client reconnected may not be seated any more.
        const seated = new Set(
          (get().publicState?.players ?? []).map((player) => player.id),
        );
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
      set({ screen: "play" });
      return;
    }

    // No room yet. Open a shared one so every board carries a code from the
    // first clue — nobody has to decide up front whether friends are joining.
    // If the rooms service can't be reached we fall back to a local room, so
    // an outage costs sharing rather than the game.
    const roomId = generateRoomCode();
    connectToRoom(set, get, roomId, true);
    const opened = get().runtime;
    if (opened) {
      // Frames written before the socket opens are queued and replayed, so
      // the board can be dealt without waiting for the connection.
      opened.sendCommand(lobby.hostId, { type: "load-game", clues });
      opened.sendCommand(lobby.hostId, {
        type: "update-settings",
        settings: {
          aiJudgeEnabled: lobby.aiJudgeEnabled,
          buzzWindowMs: get().preferences.buzzWindowSeconds * 1_000,
        },
      });
      if (opened instanceof NetworkRoomRuntime) {
        for (const bot of lobby.bots) {
          opened.addBot({
            id: bot.id,
            displayName: bot.name,
            profileId: bot.profile.id,
            emoji: bot.emoji,
            color: bot.color,
          });
        }
      }
      opened.sendCommand(lobby.hostId, { type: "start-game" });
    }
    watchForRoomFallback(set, get, roomId);
    set({ screen: "play" });
  },
  exitToLobby: () => {
    const { runtime, online, lobby } = get();
    if (online && runtime) {
      // Shared rooms stay open — reloading the board resets everyone at once.
      const clues = resolveClues(lobby);
      if (clues.length > 0) {
        runtime.sendCommand(lobby.hostId, { type: "load-game", clues });
      }
      set({ screen: "play" });
      return;
    }
    if (runtime) runtime.destroy();
    set({
      runtime: null,
      publicState: null,
      screen: "play",
    });
  },
  setPublicState: (state) => set({ publicState: state }),
  setLastEvents: (events) => set({ lastEvents: events }),
  setLastCue: (cue) => set({ lastCue: cue }),
  appendChat: (message) =>
    set((state) => ({ chat: [...state.chat, message].slice(-200) })),
}));

type StoreSet = (
  partial:
    | Partial<GameStoreState>
    | ((state: GameStoreState) => Partial<GameStoreState>),
) => void;
type StoreGet = () => GameStoreState;

/** The clue set the lobby currently has staged, from an episode or a build. */
function resolveClues(lobby: LobbyConfig): GameClue[] {
  if (lobby.customGame) {
    return lobby.customGame.clues;
  }
  if (!lobby.loadedEpisode) return [];
  const normalized = normalizeArchivedEpisode(lobby.loadedEpisode.episode, {
    id: lobby.loadedEpisode.id,
    title: lobby.loadedEpisode.title,
  });
  return normalized.ok ? normalized.game.clues : [];
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
function watchForRoomFallback(set: StoreSet, get: StoreGet, roomId: string) {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    const state = get();
    // Someone else's room, a room that connected, or a game already left
    // behind — none of those are ours to replace.
    if (state.online?.roomId !== roomId) return;
    if (state.online.status === "connected") return;
    startLocalGame(set, get);
  }, roomConnectGraceMs);
}

/** Builds the room inside this tab. Solo play, and the offline fallback. */
function startLocalGame(set: StoreSet, get: StoreGet) {
  const { lobby, runtime } = get();
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
        aiAvatarHostEnabled: get().preferences.avatarHostMode !== "off",
        buzzWindowMs: get().preferences.buzzWindowSeconds * 1_000,
      },
    },
    {
      onPublicState: (state) => set({ publicState: state }),
      onEvents: (events) => set({ lastEvents: events }),
      onChat: (message) => set((s) => ({ chat: [...s.chat, message].slice(-200) })),
    },
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

function connectToRoom(
  set: StoreSet,
  get: StoreGet,
  roomId: string,
  isHost: boolean,
) {
  const { lobby } = get();
  // "You" is fine on your own screen but useless when three people share a
  // board, so give an unnamed player something the room can tell apart.
  const displayName =
    lobby.hostName.trim() && lobby.hostName.trim() !== "You"
      ? lobby.hostName.trim()
      : `Player ${lobby.hostId.replace(/^p-/, "").slice(0, 3).toUpperCase()}`;

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

  const runtime = new NetworkRoomRuntime(
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
      onPublicState: (state) => set({ publicState: state }),
      onEvents: (events) => set({ lastEvents: events }),
      onChat: (message) =>
        set((state) => ({
          chat: [...state.chat, message]
            .filter(
              (entry, index, all) =>
                all.findIndex((candidate) => candidate.id === entry.id) === index,
            )
            .slice(-200),
        })),
      onStatus: (status, detail) =>
        set((state) => ({
          online: state.online
            ? { ...state.online, status, error: detail ?? undefined }
            : { roomId, status, isHost, error: detail },
        })),
    },
  );

  set({ runtime });
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __game: typeof useGameStore }).__game = useGameStore;
}
