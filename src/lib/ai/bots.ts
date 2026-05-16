import type { BotProfile } from "@/lib/foundation/game-contracts";
import type { GameClue } from "@/lib/game";

export interface BotRng {
  next: () => number;
}

export function createSeededRng(seed: number): BotRng {
  let state = seed >>> 0 || 0x9e3779b9;
  return {
    next: () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export interface BotBuzzDecision {
  shouldBuzz: boolean;
  buzzDelayMs: number;
  knowsAnswer: boolean;
}

export function decideBotBuzz(
  profile: BotProfile,
  clue: GameClue,
  rng: BotRng,
): BotBuzzDecision {
  const knowledgeRoll = rng.next();
  const categoryBoost = clueDifficultyAdjustment(clue);
  const effectiveAccuracy = clamp01(profile.targetAccuracy + categoryBoost);
  const knowsAnswer = knowledgeRoll < effectiveAccuracy;

  if (!knowsAnswer) {
    return { shouldBuzz: false, buzzDelayMs: 0, knowsAnswer: false };
  }

  const span = profile.maxBuzzDelayMs - profile.minBuzzDelayMs;
  const buzzDelayMs = profile.minBuzzDelayMs + Math.floor(rng.next() * Math.max(0, span));
  return { shouldBuzz: true, buzzDelayMs, knowsAnswer };
}

export interface BotAnswerDecision {
  answer: string;
  isAttempting: boolean;
}

export function decideBotAnswer(
  profile: BotProfile,
  clue: GameClue,
  rng: BotRng,
): BotAnswerDecision {
  const accuracyRoll = rng.next();
  const correctChance = clamp01(profile.targetAccuracy + 0.15);
  if (accuracyRoll < correctChance) {
    return {
      answer: clue.correctResponse,
      isAttempting: true,
    };
  }
  if (rng.next() < 0.4) {
    return { answer: "", isAttempting: false };
  }
  return {
    answer: scrambleAnswer(clue.correctResponse, rng),
    isAttempting: true,
  };
}

export interface BotWagerInput {
  profile: BotProfile;
  clue: GameClue;
  currentScore: number;
  leaderScore: number;
  round: GameClue["round"];
  rng: BotRng;
}

export function decideBotWager({
  profile,
  clue,
  currentScore,
  leaderScore,
  round,
  rng,
}: BotWagerInput): number {
  if (round === "final-jeopardy") {
    if (currentScore <= 0) {
      return 0;
    }
    if (currentScore >= leaderScore) {
      const required = Math.max(0, leaderScore * 2 - currentScore) + 1;
      const aggressive = Math.floor(currentScore * (0.4 + profile.wagerAggression * 0.5));
      return Math.min(currentScore, Math.max(required, aggressive));
    }
    return Math.floor(currentScore * (0.4 + profile.wagerAggression * 0.5));
  }

  const baseValue = clue.value;
  const aggression = profile.wagerAggression;
  const jitter = 0.7 + rng.next() * 0.6;
  const max = Math.max(currentScore, roundMinimumWager(round));
  const target = Math.floor(baseValue * (1 + aggression) * jitter);
  return Math.min(max, Math.max(5, target));
}

function roundMinimumWager(round: GameClue["round"]) {
  return round === "jeopardy"
    ? 1_000
    : round === "double-jeopardy"
      ? 2_000
      : round === "triple-jeopardy"
        ? 3_000
        : 0;
}

function clueDifficultyAdjustment(clue: GameClue) {
  if (clue.value <= 200) return 0.1;
  if (clue.value <= 600) return 0.05;
  if (clue.value <= 1_000) return 0;
  if (clue.value <= 1_600) return -0.05;
  return -0.1;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function scrambleAnswer(answer: string, rng: BotRng) {
  const words = answer.split(/\s+/);
  if (words.length === 1) {
    const letters = words[0].split("");
    if (letters.length > 2 && rng.next() < 0.7) {
      const i = 1 + Math.floor(rng.next() * (letters.length - 2));
      const j = 1 + Math.floor(rng.next() * (letters.length - 2));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    return letters.join("");
  }
  const dropIndex = Math.floor(rng.next() * words.length);
  return words.filter((_, index) => index !== dropIndex).join(" ").trim() || words[0];
}
