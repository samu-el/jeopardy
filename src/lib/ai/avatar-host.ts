import { roundName } from "@/lib/game";
import {
  baselineAvatarHostProfiles,
  type AvatarHostMode,
  type AvatarHostProfile,
} from "@/lib/ai/profiles";

export type AvatarHostCueType =
  | "intro"
  | "intro-categories"
  | "clue-selected"
  | "clue-readout"
  | "buzzer-unlocked"
  | "answer-correct"
  | "answer-incorrect"
  | "round-advance"
  | "final-prompt"
  | "game-complete"
  | "pacing-reminder";

export interface AvatarHostCue {
  id: string;
  type: AvatarHostCueType;
  text: string;
  speak: boolean;
  animationHint?: "idle" | "lean-in" | "applaud" | "thoughtful";
}

export interface AvatarHostInput {
  type: AvatarHostCueType;
  context?: {
    playerName?: string;
    category?: string;
    value?: number;
    round?: string;
    score?: number;
    clueText?: string;
    correctResponse?: string;
    categories?: string[];
  };
  profile?: AvatarHostProfile;
  mode?: AvatarHostMode;
}

export function defaultAvatarHostProfile() {
  return baselineAvatarHostProfiles[0];
}

/**
 * What the host says, as a table.
 *
 * Each cue names the line it reads, how it should move, and whether it is
 * allowed to speak at all. It used to be an eleven-arm switch where every arm
 * rebuilt the same object; the only things that ever actually differed are
 * the three columns below.
 */
const cueScripts: Record<
  AvatarHostCueType,
  {
    say: (context: NonNullable<AvatarHostInput["context"]>, profile: AvatarHostProfile) => string;
    move?: AvatarHostCue["animationHint"];
    /** Cues that are beats rather than lines, or that a profile can mute. */
    silent?: boolean;
    needsReminders?: boolean;
  }
> = {
  intro: { say: () => "", silent: true },
  "intro-categories": {
    say: (context) =>
      (context.categories ?? []).length === 0
        ? "Here are your categories."
        : `Today's categories are: ${formatCategoryList(context.categories ?? [])}.`,
    move: "lean-in",
  },
  "clue-selected": {
    say: ({ category, value }) =>
      category && value !== undefined ? `${category}, for ${value}.` : category ?? `${value ?? ""}`,
    move: "lean-in",
  },
  "clue-readout": { say: (context) => context.clueText ?? "", move: "lean-in" },
  "buzzer-unlocked": { say: () => "", silent: true },
  "answer-correct": {
    say: ({ playerName }) =>
      playerName ? `That is correct, ${playerName}.` : "That is correct.",
    move: "applaud",
  },
  "answer-incorrect": {
    say: (_context, profile) =>
      profile.allowCommentary ? "Not quite. Anyone else want to give it a try?" : "Incorrect.",
    move: "thoughtful",
  },
  "round-advance": {
    say: ({ round }) => (round ? `Onward to ${roundName(round, "spoken")}.` : "Onward."),
  },
  "final-prompt": { say: () => "Final Jeopardy. Make your wagers.", move: "lean-in" },
  "game-complete": {
    say: ({ playerName }) =>
      playerName ? `That's the game. Congratulations, ${playerName}.` : "That's the game.",
    move: "applaud",
  },
  "pacing-reminder": {
    say: () => "Make a selection when you're ready.",
    needsReminders: true,
  },
};

export function generateAvatarHostCue(input: AvatarHostInput): AvatarHostCue {
  const profile = input.profile ?? defaultAvatarHostProfile();
  const mode = input.mode ?? profile.defaultMode;
  const script = cueScripts[input.type];
  return {
    id: `${input.type}-${Date.now()}`,
    type: input.type,
    text: script.say(input.context ?? {}, profile),
    speak:
      mode !== "off" && !script.silent && (!script.needsReminders || profile.allowRuleReminders),
    animationHint: script.move ?? "idle",
  };
}

function formatCategoryList(categories: string[]): string {
  if (categories.length === 0) return "";
  if (categories.length === 1) return categories[0];
  if (categories.length === 2) return `${categories[0]} and ${categories[1]}`;
  return `${categories.slice(0, -1).join(", ")}, and ${categories[categories.length - 1]}`;
}
