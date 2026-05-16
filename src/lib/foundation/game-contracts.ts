export const roundNames = [
  "lobby",
  "jeopardy",
  "double-jeopardy",
  "triple-jeopardy",
  "final-jeopardy",
  "complete",
] as const;

export type RoundName = (typeof roundNames)[number];

export type PlayerKind = "human" | "ai-bot";

export type BotDifficulty = "rookie" | "casual" | "champion" | "legend";

export type AvatarHostMode = "off" | "voice-only" | "avatar-and-voice";

export type AvatarHostPersona =
  | "classic-host"
  | "friendly-coach"
  | "dry-commentator";

export interface Player {
  id: string;
  displayName: string;
  kind: PlayerKind;
  connected: boolean;
  spectator: boolean;
  score: number;
}

export interface Clue {
  id: string;
  round: Exclude<RoundName, "lobby" | "complete">;
  category: string;
  value: number;
  clue: string;
  correctResponse: string;
  dailyDouble?: boolean;
}

export interface VoiceProfile {
  id: string;
  label: string;
  provider: "browser" | "openai" | "external";
  locale: string;
  description: string;
}

export interface BotProfile {
  id: string;
  label: string;
  difficulty: BotDifficulty;
  minBuzzDelayMs: number;
  maxBuzzDelayMs: number;
  targetAccuracy: number;
  wagerAggression: number;
}

export interface AvatarHostProfile {
  id: string;
  label: string;
  persona: AvatarHostPersona;
  defaultMode: AvatarHostMode;
  voiceProfileId: string;
  allowCommentary: boolean;
  allowRuleReminders: boolean;
  description: string;
}

export interface GameRoomSettings {
  answerTimeoutMs: number;
  finalTimeoutMs: number;
  allowMultipleCorrect: boolean;
  hostId?: string;
  voiceProfileId?: string;
  avatarHostProfileId?: string;
  aiJudgeEnabled: boolean;
  aiBotsEnabled: boolean;
  aiAvatarHostEnabled: boolean;
}

export const baselineVoiceProfiles: VoiceProfile[] = [
  {
    id: "browser-default",
    label: "Browser default",
    provider: "browser",
    locale: "en-US",
    description: "Uses the local browser speech synthesis voice.",
  },
  {
    id: "studio-neutral",
    label: "Studio neutral",
    provider: "openai",
    locale: "en-US",
    description: "Clear hosted readout suitable for noisy game rooms.",
  },
  {
    id: "classic-host",
    label: "Classic host",
    provider: "external",
    locale: "en-US",
    description: "Pluggable voice adapter for custom hosted voices.",
  },
];

export const baselineBotProfiles: BotProfile[] = [
  {
    id: "rookie",
    label: "Rookie",
    difficulty: "rookie",
    minBuzzDelayMs: 1200,
    maxBuzzDelayMs: 2600,
    targetAccuracy: 0.34,
    wagerAggression: 0.2,
  },
  {
    id: "casual",
    label: "Casual",
    difficulty: "casual",
    minBuzzDelayMs: 700,
    maxBuzzDelayMs: 1800,
    targetAccuracy: 0.52,
    wagerAggression: 0.45,
  },
  {
    id: "champion",
    label: "Champion",
    difficulty: "champion",
    minBuzzDelayMs: 250,
    maxBuzzDelayMs: 950,
    targetAccuracy: 0.74,
    wagerAggression: 0.7,
  },
  {
    id: "legend",
    label: "Legend",
    difficulty: "legend",
    minBuzzDelayMs: 90,
    maxBuzzDelayMs: 420,
    targetAccuracy: 0.88,
    wagerAggression: 0.9,
  },
];

export const baselineAvatarHostProfiles: AvatarHostProfile[] = [
  {
    id: "classic-host",
    label: "Classic Host",
    persona: "classic-host",
    defaultMode: "avatar-and-voice",
    voiceProfileId: "classic-host",
    allowCommentary: false,
    allowRuleReminders: true,
    description: "A restrained game-show host that reads clues and handles pacing.",
  },
  {
    id: "friendly-coach",
    label: "Friendly Coach",
    persona: "friendly-coach",
    defaultMode: "voice-only",
    voiceProfileId: "studio-neutral",
    allowCommentary: true,
    allowRuleReminders: true,
    description: "A warmer host for solo practice, onboarding, and casual rooms.",
  },
  {
    id: "dry-commentator",
    label: "Dry Commentator",
    persona: "dry-commentator",
    defaultMode: "voice-only",
    voiceProfileId: "studio-neutral",
    allowCommentary: true,
    allowRuleReminders: false,
    description: "A low-interruption host for light table-talk between clues.",
  },
];
