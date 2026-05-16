"use client";

import { create } from "zustand";
import type { BotProfile } from "@/lib/foundation/game-contracts";
import type { GameEvent, PublicGameState } from "@/lib/game";
import { LocalRoomRuntime, type ChatMessage } from "@/lib/runtime";
import {
  normalizeArchivedEpisode,
  type ArchivedEpisodeInput,
  type BuilderGame,
  type GameDataIssue,
  type NormalizedGame,
} from "@/lib/data";
import { defaultAvatarHostProfile, type AvatarHostCue } from "@/lib/ai";

export type ScreenName = "landing" | "play" | "results";

export interface UiPreferences {
  reducedMotion: boolean;
  soundEnabled: boolean;
  voiceProfileId: string;
  avatarHostProfileId: string;
  avatarHostMode: "off" | "voice-only" | "avatar-and-voice";
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

export interface GameStoreState {
  screen: ScreenName;
  preferences: UiPreferences;
  lobby: LobbyConfig;
  chat: ChatMessage[];
  publicState: PublicGameState | null;
  runtime: LocalRoomRuntime | null;
  lastEvents: GameEvent[];
  lastCue: AvatarHostCue | null;
  /**
   * Set when the app is opened with ?room=<id>. The landing page shows
   * the join flow when this is non-null.
   */
  pendingRoomId: string | null;
  setPendingRoomId: (id: string | null) => void;
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
    soundEnabled: true,
    voiceProfileId: "female-natural",
    avatarHostProfileId: defaultAvatarHostProfile().id,
    avatarHostMode: "voice-only",
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
  lastEvents: [],
  lastCue: null,
  pendingRoomId: null,
  setPendingRoomId: (id) => set({ pendingRoomId: id }),
  setScreen: (screen) => set({ screen }),
  setHostName: (name) =>
    set((state) => ({
      lobby: { ...state.lobby, hostName: name.trim() || "You" },
    })),
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
    const { runtime } = get();
    if (runtime) runtime.destroy();
    set((state) => ({
      runtime: null,
      publicState: null,
      chat: [],
      lastEvents: [],
      lastCue: null,
      lobby: {
        ...state.lobby,
        loadedEpisode: loaded,
        customGame: loaded ? undefined : state.lobby.customGame,
      },
    }));
  },
  setCustomGame: (game, issues) => {
    const { runtime } = get();
    if (runtime && game) runtime.destroy();
    set((state) => ({
      runtime: game ? null : state.runtime,
      publicState: game ? null : state.publicState,
      chat: game ? [] : state.chat,
      lastEvents: game ? [] : state.lastEvents,
      lastCue: game ? null : state.lastCue,
      lobby: {
        ...state.lobby,
        customGame: game,
        customIssues: issues,
        loadedEpisode: game ? undefined : state.lobby.loadedEpisode,
      },
    }));
  },
  addBot: (profile) =>
    set((state) => ({
      lobby: {
        ...state.lobby,
        bots: [
          ...state.lobby.bots,
          {
            id: makeId("bot"),
            name: `${profile.label} #${state.lobby.bots.length + 1}`,
            profile,
          },
        ],
      },
    })),
  removeBot: (id) =>
    set((state) => ({
      lobby: {
        ...state.lobby,
        bots: state.lobby.bots.filter((bot) => bot.id !== id),
      },
    })),
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
  setHostSpectator: (spectator) =>
    set((state) => ({
      lobby: { ...state.lobby, hostSpectator: spectator },
    })),
  setPreference: (key, value) =>
    set((state) => ({
      preferences: { ...state.preferences, [key]: value },
    })),
  startGame: () => {
    const { lobby, runtime } = get();
    if (runtime) runtime.destroy();

    const clues = (() => {
      if (lobby.customGame) {
        return lobby.customGame.clues;
      }
      if (!lobby.loadedEpisode) return [];
      const normalized = normalizeArchivedEpisode(lobby.loadedEpisode.episode, {
        id: lobby.loadedEpisode.id,
        title: lobby.loadedEpisode.title,
      });
      return normalized.ok ? normalized.game.clues : [];
    })();

    if (clues.length === 0) {
      return;
    }

    const newRuntime = new LocalRoomRuntime(
      {
        roomId: `room-${Date.now()}`,
        hostId: lobby.hostId,
        hostName: lobby.hostName,
        humanPlayers: [
          { id: lobby.hostId, name: lobby.hostName, spectator: lobby.hostSpectator },
          ...lobby.extraHumans,
        ],
        bots: lobby.bots.map((bot) => ({
          id: bot.id,
          name: bot.name,
          profile: bot.profile,
        })),
        clues,
        settings: {
          aiJudgeEnabled: lobby.aiJudgeEnabled,
          aiBotsEnabled: lobby.bots.length > 0,
          aiAvatarHostEnabled: get().preferences.avatarHostMode !== "off",
        },
      },
      {
        onPublicState: (state) => set({ publicState: state }),
        onEvents: (events) => set({ lastEvents: events }),
        onChat: (message) => set((s) => ({ chat: [...s.chat, message].slice(-200) })),
      },
    );

    set({
      runtime: newRuntime,
      screen: "play",
      publicState: newRuntime.getPublicState(),
      chat: [],
    });

    // Auto-deal the board so Begin = one click.
    newRuntime.sendCommand(lobby.hostId, { type: "start-game" });
  },
  exitToLobby: () => {
    const { runtime } = get();
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

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __game: typeof useGameStore }).__game = useGameStore;
}
