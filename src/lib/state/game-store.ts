"use client";

import { create } from "zustand";
import { baselineBotProfiles, type BotProfile } from "@/lib/foundation/game-contracts";
import type { GameEvent, PublicGameState } from "@/lib/game";
import { LocalRoomRuntime, type ChatMessage } from "@/lib/runtime";
import { sampleEpisodes } from "@/lib/sample-games";
import {
  normalizeArchivedEpisode,
  type BuilderGame,
  type GameDataIssue,
  type NormalizedGame,
} from "@/lib/data";
import { defaultAvatarHostProfile, type AvatarHostCue } from "@/lib/ai";

export type ScreenName = "lobby" | "play" | "results";

export interface UiPreferences {
  captionsEnabled: boolean;
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
}

export interface LobbyConfig {
  hostName: string;
  hostId: string;
  selectedGameId: string;
  customGame?: NormalizedGame;
  customIssues: GameDataIssue[];
  bots: LobbyBotConfig[];
  extraHumans: { id: string; name: string }[];
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
  setScreen: (screen: ScreenName) => void;
  setHostName: (name: string) => void;
  selectGame: (id: string) => void;
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
  setPreference: <K extends keyof UiPreferences>(key: K, value: UiPreferences[K]) => void;
  startGame: () => void;
  exitToLobby: () => void;
  setPublicState: (state: PublicGameState) => void;
  setLastEvents: (events: GameEvent[]) => void;
  setLastCue: (cue: AvatarHostCue) => void;
  appendChat: (message: ChatMessage) => void;
}

const initialBots: LobbyBotConfig[] = [
  {
    id: "bot-casual",
    name: "Casey (Casual)",
    profile: baselineBotProfiles[1],
  },
  {
    id: "bot-champion",
    name: "Champ (Champion)",
    profile: baselineBotProfiles[2],
  },
];

const stableHostId = "you";

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  screen: "lobby",
  preferences: {
    captionsEnabled: true,
    reducedMotion: false,
    soundEnabled: true,
    voiceProfileId: "female-natural",
    avatarHostProfileId: defaultAvatarHostProfile().id,
    avatarHostMode: "voice-only",
  },
  lobby: {
    hostName: "You",
    hostId: stableHostId,
    selectedGameId: sampleEpisodes[0].id,
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
  setScreen: (screen) => set({ screen }),
  setHostName: (name) =>
    set((state) => ({
      lobby: { ...state.lobby, hostName: name.trim() || "You" },
    })),
  selectGame: (id) =>
    set((state) => ({
      lobby: {
        ...state.lobby,
        selectedGameId: id,
        customGame: id === "custom" ? state.lobby.customGame : undefined,
      },
    })),
  setCustomGame: (game, issues) =>
    set((state) => ({
      lobby: {
        ...state.lobby,
        customGame: game,
        customIssues: issues,
        selectedGameId: game ? "custom" : state.lobby.selectedGameId,
      },
    })),
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
  setPreference: (key, value) =>
    set((state) => ({
      preferences: { ...state.preferences, [key]: value },
    })),
  startGame: () => {
    const { lobby, runtime } = get();
    if (runtime) runtime.destroy();

    const clues = (() => {
      if (lobby.selectedGameId === "custom" && lobby.customGame) {
        return lobby.customGame.clues;
      }
      const episode = sampleEpisodes.find((sample) => sample.id === lobby.selectedGameId)
        ?? sampleEpisodes[0];
      const normalized = normalizeArchivedEpisode(episode.data, {
        id: episode.id,
        title: episode.title,
      });
      return normalized.ok ? normalized.game.clues : [];
    })();

    const newRuntime = new LocalRoomRuntime(
      {
        roomId: `room-${Date.now()}`,
        hostId: lobby.hostId,
        hostName: lobby.hostName,
        humanPlayers: [
          { id: lobby.hostId, name: lobby.hostName },
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
  },
  exitToLobby: () => {
    const { runtime } = get();
    if (runtime) runtime.destroy();
    set({
      runtime: null,
      publicState: null,
      screen: "lobby",
    });
  },
  setPublicState: (state) => set({ publicState: state }),
  setLastEvents: (events) => set({ lastEvents: events }),
  setLastCue: (cue) => set({ lastCue: cue }),
  appendChat: (message) =>
    set((state) => ({ chat: [...state.chat, message].slice(-200) })),
}));
