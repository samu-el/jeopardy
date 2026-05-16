import {
  baselineAvatarHostProfiles,
  type AvatarHostMode,
  type AvatarHostProfile,
} from "@/lib/foundation/game-contracts";

export type AvatarHostCueType =
  | "intro"
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
  };
  profile?: AvatarHostProfile;
  mode?: AvatarHostMode;
}

const personaTone: Record<AvatarHostProfile["persona"], string> = {
  "classic-host": "crisp and stately",
  "friendly-coach": "warm and supportive",
  "dry-commentator": "deadpan and concise",
};

export function defaultAvatarHostProfile() {
  return baselineAvatarHostProfiles[0];
}

export function generateAvatarHostCue(input: AvatarHostInput): AvatarHostCue {
  const profile = input.profile ?? defaultAvatarHostProfile();
  const mode = input.mode ?? profile.defaultMode;
  const speak = mode !== "off";

  switch (input.type) {
    case "intro":
      return {
        id: `intro-${Date.now()}`,
        type: "intro",
        text: greeting(profile),
        speak,
        animationHint: "lean-in",
      };
    case "clue-readout":
      return {
        id: `clue-${Date.now()}`,
        type: "clue-readout",
        text: input.context?.clueText ?? "",
        speak,
        animationHint: "lean-in",
      };
    case "buzzer-unlocked":
      return {
        id: `buzz-${Date.now()}`,
        type: "buzzer-unlocked",
        text: "Buzzers are open.",
        speak: speak && profile.allowRuleReminders,
        animationHint: "idle",
      };
    case "answer-correct":
      return {
        id: `correct-${Date.now()}`,
        type: "answer-correct",
        text: input.context?.playerName
          ? `That is correct, ${input.context.playerName}.`
          : "That is correct.",
        speak,
        animationHint: "applaud",
      };
    case "answer-incorrect":
      return {
        id: `incorrect-${Date.now()}`,
        type: "answer-incorrect",
        text: profile.allowCommentary
          ? "Not quite. Anyone else want to give it a try?"
          : "Incorrect.",
        speak,
        animationHint: "thoughtful",
      };
    case "round-advance":
      return {
        id: `round-${Date.now()}`,
        type: "round-advance",
        text: input.context?.round
          ? `Onward to ${humanRoundName(input.context.round)}.`
          : "Onward.",
        speak,
        animationHint: "idle",
      };
    case "final-prompt":
      return {
        id: `final-${Date.now()}`,
        type: "final-prompt",
        text: "Final Jeopardy. Make your wagers.",
        speak,
        animationHint: "lean-in",
      };
    case "game-complete":
      return {
        id: `complete-${Date.now()}`,
        type: "game-complete",
        text: input.context?.playerName
          ? `That's the game. Congratulations, ${input.context.playerName}.`
          : "That's the game.",
        speak,
        animationHint: "applaud",
      };
    case "pacing-reminder":
      return {
        id: `pacing-${Date.now()}`,
        type: "pacing-reminder",
        text: "Make a selection when you're ready.",
        speak: speak && profile.allowRuleReminders,
        animationHint: "idle",
      };
  }
}

function greeting(profile: AvatarHostProfile) {
  const tone = personaTone[profile.persona];
  switch (profile.persona) {
    case "classic-host":
      return `Welcome to Jeopardy. Your host, ${profile.label}, here. Let's play.`;
    case "friendly-coach":
      return `Hey, glad you made it. We've got a great board lined up — relax and have fun.`;
    case "dry-commentator":
      return `Welcome. It's a game show. You know the rules. (Tone: ${tone}.)`;
  }
}

function humanRoundName(round: string) {
  switch (round) {
    case "jeopardy":
      return "Jeopardy";
    case "double-jeopardy":
      return "Double Jeopardy";
    case "triple-jeopardy":
      return "Triple Jeopardy";
    case "final-jeopardy":
      return "Final Jeopardy";
    case "complete":
      return "the end of the game";
    default:
      return round;
  }
}
