/**
 * The house voices, bots and hosts.
 *
 * These are presets, not game rules: the engine never reads them. A room
 * stores only the id it was pointed at, so a profile can be re-tuned here
 * without touching a single saved game.
 */

export type BotDifficulty = "rookie" | "casual" | "champion" | "legend";
export type AvatarHostMode = "off" | "voice-only" | "avatar-and-voice";
export type AvatarHostPersona = "classic-host" | "friendly-coach" | "dry-commentator";

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
  /**
   * Words the bot is drawn to in a category name: it prefers matching
   * categories when picking, and answers them a little better.
   */
  categoryBias?: string[];
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

/** Ordered easiest to hardest: a harder bot rings in sooner and is right more often. */
export const baselineBotProfiles: BotProfile[] = [
  {
    id: "rookie",
    label: "Rookie",
    difficulty: "rookie",
    minBuzzDelayMs: 1300,
    maxBuzzDelayMs: 2800,
    targetAccuracy: 0.34,
    wagerAggression: 0.2,
    categoryBias: ["pop", "kids", "tv", "movie"],
  },
  {
    id: "casual",
    label: "Casual",
    difficulty: "casual",
    minBuzzDelayMs: 800,
    maxBuzzDelayMs: 2000,
    targetAccuracy: 0.52,
    wagerAggression: 0.45,
    categoryBias: ["history", "geography", "sports"],
  },
  {
    id: "champion",
    label: "Champion",
    difficulty: "champion",
    minBuzzDelayMs: 400,
    maxBuzzDelayMs: 1200,
    targetAccuracy: 0.74,
    wagerAggression: 0.7,
    categoryBias: ["science", "literature", "math"],
  },
  {
    id: "legend",
    label: "Legend",
    difficulty: "legend",
    minBuzzDelayMs: 250,
    maxBuzzDelayMs: 700,
    targetAccuracy: 0.88,
    wagerAggression: 0.9,
    categoryBias: ["world", "language", "art", "classical"],
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
