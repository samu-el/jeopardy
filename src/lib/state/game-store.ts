"use client";

import { create } from "zustand";
import type { BotProfile } from "@/lib/ai/profiles";
import type { GameEvent, PublicGameState } from "@/lib/game";
import {
  NetworkRoomRuntime,
  type ChatMessage,
  type RoomConnectionStatus,
  type RoomProblem,
  type RoomRuntime,
} from "@/lib/runtime";
import {
  fetchPublishedGame,
  publishedGameToNormalized,
  fetchRandomEpisode,
  type ArchivedEpisodeInput,
  type BuilderGame,
  type GameDataIssue,
  type NormalizedGame,
} from "@/lib/data";
import { defaultAvatarHostProfile, type AvatarHostCue } from "@/lib/ai";
import { normalizeRoomCode } from "@/lib/realtime/room-code";
import {
  committableName,
  connectToRoom,
  dealBoard,
  lookupMessage,
  lookupRoom,
  openHostedRoom,
  pushNotice,
  resolveClues,
  startLocalGame,
} from "./room-session";
import type { RoomNotice } from "./notices";
import { displayClientId, forgetRoomSeat, recallRoomSeat, writeRoomToUrl } from "./room-memory";
import { selectCanHost, selectIsLiveGame } from "./selectors";

export { defaultPlayerName, resolvePlayerName } from "./room-session";

export type ScreenName = "landing" | "play" | "results";

export interface UiPreferences {
  reducedMotion: boolean;
  soundEnabled: boolean;
  /** The host's line, printed on screen. Off unless it is asked for. */
  subtitlesEnabled: boolean;
  /**
   * Room chat under the lecterns. Off unless it is asked for: most games are
   * played by people in the same room, who talk.
   */
  chatEnabled: boolean;
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
  /** This client opened the room (used until the room's own state says who hosts). */
  isHost: boolean;
  /** A player sits at a lectern; a display only watches, under its own id. */
  role: "player" | "display";
  /** The room has let this client in at least once. */
  everConnected: boolean;
  /** Why the room isn't live, when it isn't: the thing a screen branches on. */
  problem?: RoomProblem;
  /** The sentence to show for it. */
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
  /** Transient room news (arrivals, departures, the chair changing hands). */
  notices: RoomNotice[];
  dismissNotice: (id: string) => void;
  /** Asking "leave this game?" before Home walks out of a live one. */
  leaveConfirmOpen: boolean;
  /** Home: leaves the room properly, asking first while a game is live. */
  goHome: () => void;
  confirmGoHome: () => void;
  cancelGoHome: () => void;
  /** Takes the seat back from another tab that opened this room. */
  takeOverRoom: () => void;
  /** Asks again after "not found" or "unreachable". */
  retryRoom: () => Promise<boolean>;
  /** Plays the staged board in this tab: only ever by explicit choice. */
  playOffline: () => void;
  /** Host-only: hands the chair to another player in the room. */
  transferHost: (playerId: string) => void;
  /** Host-only: removes a player from the room. */
  removePlayer: (playerId: string) => void;
  /** Sends the name being typed now instead of waiting out the debounce. */
  commitHostName: () => void;
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
    chatEnabled: false,
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
  notices: [],
  dismissNotice: (id) =>
    set((state) => ({ notices: state.notices.filter((notice) => notice.id !== id) })),
  leaveConfirmOpen: false,
  goHome: () => {
    const state = get();
    // Walking out of a game in progress costs a seat (and maybe the chair),
    // so it is asked, not assumed.
    if (state.runtime && selectIsLiveGame(state)) {
      set({ leaveConfirmOpen: true });
      return;
    }
    leaveAndGoHome();
  },
  confirmGoHome: () => leaveAndGoHome(),
  cancelGoHome: () => set({ leaveConfirmOpen: false }),
  takeOverRoom: () => {
    const { online } = get();
    if (!online) return;
    connectToRoom(set, get, online.roomId, onlineConnectOptions(online));
  },
  retryRoom: async () => {
    const { online } = get();
    if (!online) return false;
    if (online.role === "display") return get().joinAsDisplay(online.roomId);
    return get().joinOnlineRoom(online.roomId);
  },
  playOffline: () => {
    const { online, runtime } = get();
    if (online?.status === "connected") return;
    if (online && runtime) runtime.destroy();
    set({ runtime: null, online: null });
    startLocalGame(set, get);
  },
  transferHost: (playerId) => {
    const state = get();
    if (!state.runtime || !selectCanHost(state)) return;
    state.runtime.sendCommand(state.selfId(), { type: "configure-host", hostId: playerId });
  },
  removePlayer: (playerId) => {
    const state = get();
    if (!state.runtime || !selectCanHost(state)) return;
    state.runtime.sendCommand(state.selfId(), { type: "leave-game", targetPlayerId: playerId });
  },
  commitHostName: () => flushName(),
  setPendingRoomId: (id) => {
    if (id) {
      // This browser already holds a seat in that room (a refresh, a host
      // back at their own code, an invite link opened twice): go straight
      // back in rather than asking who you are again.
      const code = normalizeRoomCode(id);
      const { lobby, online } = get();
      if (!online && code && recallRoomSeat(code, lobby.hostId)) {
        set({ pendingRoomId: null });
        void get()
          .joinOnlineRoom(code)
          .then((joined) => {
            if (joined) return;
            forgetRoomSeat(code, get().lobby.hostId);
            set({ pendingRoomId: code, screen: "landing" });
          });
        return;
      }
    }
    set({ pendingRoomId: id });
  },
  selfId: () => {
    const { runtime, lobby } = get();
    return runtime?.selfId ?? lobby.hostId;
  },
  setScreen: (screen) => {
    // "Home" from anywhere in a room means leaving it, not hiding it: a
    // landing page over a live socket left a connected ghost holding a seat.
    if (screen === "landing" && get().runtime) {
      get().goHome();
      return;
    }
    set({ screen });
  },
  setHostName: (name) => {
    // The field keeps exactly what was typed, empty included; only a real
    // name is ever sent, and only once typing pauses.
    set((state) => ({ lobby: { ...state.lobby, hostName: name } }));
    scheduleNameFlush();
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
    if (state.online && !selectCanHost(state)) {
      pushNotice(set, { kind: "refused", text: "Only the host can add bots." });
      return;
    }
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
    if (online && !selectCanHost(get())) return;
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
  setAiJudge: (enabled) => {
    const state = get();
    if (state.online && !selectCanHost(state)) return;
    set({ lobby: { ...state.lobby, aiJudgeEnabled: enabled } });
    // The room judges, so the room has to hear it: switching the judge off
    // mid-game used to change a local flag while the room kept ruling.
    if (state.runtime && selectCanHost(state)) {
      state.runtime.sendCommand(state.selfId(), {
        type: "update-settings",
        settings: { aiJudgeEnabled: enabled },
      });
    }
  },
  setHostControlsAuto: (auto) => {
    const state = get();
    if (state.online && !selectCanHost(state)) return;
    set({ lobby: { ...state.lobby, hostControlsAuto: auto } });
  },
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
      const { runtime, lobby } = get();
      if (runtime && selectCanHost(get())) {
        runtime.sendCommand(lobby.hostId, {
          type: "update-settings",
          settings: { buzzWindowMs: Number(value) * 1_000 },
        });
      }
    }
  },
  setDisplayMode: (on) => set({ displayMode: on }),
  joinAsDisplay: async (roomId) => {
    // A display takes no seat and has its own id, so it can sit in the same
    // browser as the host without taking the host's chair, and its name and
    // spectator flag never touch the lobby this browser keeps.
    set({ displayMode: true });
    const normalized = normalizeRoomCode(roomId);
    const found = await lookupOrReport(normalized, "display");
    // A television keeps checking on its own (DisplayView retries while
    // `online.problem` is "not-found" or "unreachable").
    if (!found) return false;
    connectToRoom(set, get, normalized, {
      create: false,
      role: "display",
      clientId: displayClientId(),
      displayName: "Display",
      spectator: true,
    });
    return true;
  },
  joinOnlineRoom: async (roomId) => {
    const { runtime } = get();
    if (runtime) runtime.destroy();
    set({ runtime: null, publicState: null, chat: [], lastEvents: [], lastCue: null });
    const normalized = normalizeRoomCode(roomId);
    const found = await lookupOrReport(normalized, "player");
    if (!found) return false;
    connectToRoom(set, get, normalized, { create: false, role: "player" });
    return true;
  },
  leaveOnlineRoom: () => {
    const { runtime, online, lobby } = get();
    if (runtime && online && online.role === "player") {
      // Give the seat back explicitly — a dropped socket mid-game is held
      // open for a reconnect, which isn't what "leave" means.
      runtime.sendCommand(lobby.hostId, { type: "leave-game" });
    }
    if (online) {
      forgetRoomSeat(online.roomId, runtime?.selfId ?? lobby.hostId);
      writeRoomToUrl(null);
    }
    if (runtime) runtime.destroy();
    set({
      runtime: null,
      online: null,
      publicState: null,
      chat: [],
      notices: [],
      lastEvents: [],
      lastCue: null,
      leaveConfirmOpen: false,
      screen: "play",
    });
  },
  pushLoadedGameToRoom: () => {
    const { runtime, lobby } = get();
    const clues = resolveClues(lobby);
    if (!runtime || clues.length === 0 || !selectCanHost(get())) return;
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
    // A guest's Begin would be refused by the room; don't send it.
    if (online && !selectCanHost(get())) return;

    if (online && runtime) {
      // The room already exists on the server: load the board, then start.
      dealBoard(runtime, get, { seatBots: "missing" });
      set({ screen: "play" });
      return;
    }

    // No room yet. Open a shared one so every board carries a code from the
    // first clue — nobody has to decide up front whether friends are joining.
    // If the rooms service can't be reached the player is offered the board
    // offline; the room keeps trying either way. Frames written before the
    // socket opens are queued and replayed, so the board is dealt at once.
    openHostedRoom(set, get);
    set({ screen: "play" });
  },
  exitToLobby: () => {
    const { runtime, online, lobby } = get();
    // Restart, Again and Lobby reset everyone's board: the host's call only.
    if (online && !selectCanHost(get())) return;
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


/** Leaves whatever room this tab is in and shows the landing page. */
function leaveAndGoHome() {
  const { online, runtime } = useGameStore.getState();
  if (online) {
    useGameStore.getState().leaveOnlineRoom();
  } else if (runtime) {
    runtime.destroy();
    useGameStore.setState({ runtime: null, publicState: null, lastEvents: [], lastCue: null });
  }
  useGameStore.setState({
    screen: "landing",
    displayMode: false,
    leaveConfirmOpen: false,
    shareUnavailable: false,
  });
}

function onlineConnectOptions(online: OnlineRoomState) {
  return online.role === "display"
    ? {
        create: false,
        role: "display" as const,
        clientId: displayClientId(),
        displayName: "Display",
        spectator: true,
      }
    : { create: false, role: "player" as const };
}

/**
 * Asks whether the room is open; if not, records why on `online` so the
 * screen can say "no such room" or "can't reach the server" (and stop
 * spinning) instead of one message for both.
 */
async function lookupOrReport(code: string, role: OnlineRoomState["role"]): Promise<boolean> {
  const result = await lookupRoom(code);
  if (result === "open") return true;
  useGameStore.setState({
    online: {
      roomId: code,
      status: "rejected",
      isHost: false,
      role,
      everConnected: false,
      problem: result,
      error: lookupMessage(code, result),
    },
  });
  return false;
}

/** A name is sent this long after the last keystroke, not on every one. */
export const nameCommitDelayMs = 600;
let nameTimer: ReturnType<typeof setTimeout> | undefined;
let lastSentName: string | undefined;

function scheduleNameFlush() {
  if (nameTimer) clearTimeout(nameTimer);
  nameTimer = setTimeout(flushName, nameCommitDelayMs);
}

function flushName() {
  if (nameTimer) clearTimeout(nameTimer);
  nameTimer = undefined;
  const { runtime, online, lobby } = useGameStore.getState();
  if (!runtime || !online || online.role !== "player") return;
  const name = committableName(lobby.hostName);
  if (!name || name === lastSentName) return;
  lastSentName = name;
  runtime.sendCommand(lobby.hostId, { type: "set-player-profile", displayName: name });
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __game: typeof useGameStore }).__game = useGameStore;
}
