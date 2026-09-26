import type { BotProfile } from "@/lib/ai/profiles";
import { judgeAnswer } from "@/lib/ai/judge";
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
  /** Whether the bot actually knows this one. A hunch buzzes without it. */
  knowsAnswer: boolean;
}

/**
 * Bots ring in against the room's own clock, which has no network in it. A
 * person sees the buzzer open only after the state broadcast reaches them,
 * and their buzz takes a trip back. This is added to every bot delay so a
 * bot's reflexes are measured on the same footing as a human's.
 */
export const botLatencyAllowanceMs = 150;

/** Chance a bot rings in on a clue it doesn't know, scaled by its confidence. */
const hunchRate = 0.12;
/** Chance a hunch turns out right. */
const hunchAccuracy = 0.25;

/** How often a bot that knows the answer also says it right. Never certain. */
export function correctWhenKnown(profile: BotProfile): number {
  return Math.min(0.95, 0.85 + 0.1 * clamp01(profile.targetAccuracy));
}

function knowledgeChance(profile: BotProfile, clue: GameClue) {
  const boost = clueDifficultyAdjustment(clue) + categoryBiasBoost(profile, clue);
  return clamp01(profile.targetAccuracy + boost);
}

export function decideBotBuzz(
  profile: BotProfile,
  clue: GameClue,
  rng: BotRng,
): BotBuzzDecision {
  const knowsAnswer = rng.next() < knowledgeChance(profile, clue);
  const hunch = !knowsAnswer && rng.next() < hunchRate * clamp01(profile.targetAccuracy);
  if (!knowsAnswer && !hunch) {
    return { shouldBuzz: false, buzzDelayMs: 0, knowsAnswer: false };
  }

  const span = Math.max(0, profile.maxBuzzDelayMs - profile.minBuzzDelayMs);
  // A hunch hesitates: it comes from the slow half of the bot's range.
  const position = hunch ? 0.5 + rng.next() * 0.5 : rng.next();
  const buzzDelayMs =
    profile.minBuzzDelayMs + Math.floor(position * span) + botLatencyAllowanceMs;
  return { shouldBuzz: true, buzzDelayMs, knowsAnswer };
}

export interface BotAnswerDecision {
  answer: string;
  isAttempting: boolean;
  knowsAnswer: boolean;
}

export interface BotAnswerOptions {
  /**
   * Carried over from the buzz. Left out (Final Jeopardy, where nobody
   * buzzes) the bot rolls its knowledge here, once.
   */
  knowsAnswer?: boolean;
  /** Real responses from elsewhere in the game, used as wrong guesses. */
  distractors?: string[];
}

/**
 * What the bot says once it has the floor. A bot that rang in always says
 * something: a wrong answer is a real, wrong answer — never a blank, and never
 * a typo the judge would wave through.
 */
export function decideBotAnswer(
  profile: BotProfile,
  clue: GameClue,
  rng: BotRng,
  options: BotAnswerOptions = {},
): BotAnswerDecision {
  const knowsAnswer = options.knowsAnswer ?? rng.next() < knowledgeChance(profile, clue);
  const correctChance = knowsAnswer ? correctWhenKnown(profile) : hunchAccuracy;
  if (rng.next() < correctChance) {
    return { answer: clue.correctResponse, isAttempting: true, knowsAnswer };
  }
  return {
    answer: makeWrongAnswer(clue.correctResponse, rng, options.distractors ?? []),
    isAttempting: true,
    knowsAnswer,
  };
}

/** Plausible, famous, wrong: what a contestant blurts out when they guess. */
const fallbackGuesses = [
  "Paris",
  "Abraham Lincoln",
  "Mars",
  "Shakespeare",
  "Napoleon",
  "the Nile",
  "Albert Einstein",
  "Mozart",
  "Jupiter",
  "Texas",
  "Rome",
  "Charles Dickens",
  "Queen Victoria",
  "Mount Everest",
  "Picasso",
  "Canada",
  "Oxygen",
  "Tokyo",
  "Beethoven",
  "Cleopatra",
  "Atlantis",
];

function isClearlyWrong(guess: string, correct: string) {
  const verdict = judgeAnswer({ submittedAnswer: guess, expectedAnswer: correct });
  return !verdict.correct && !verdict.ambiguous;
}

/** A guess the judge is sure to rule wrong. Exported for tests. */
export function makeWrongAnswer(
  correct: string,
  rng: BotRng,
  distractors: string[] = [],
): string {
  const candidates: string[] = [];
  const pool = distractors.filter((entry) => entry.trim());
  if (pool.length > 0 && rng.next() < 0.6) {
    candidates.push(pool[Math.floor(rng.next() * pool.length)]);
  }
  const number = /\d+/.exec(correct);
  if (number) {
    const value = Number(number[0]);
    const delta = 1 + Math.floor(rng.next() * Math.max(2, Math.min(20, Math.ceil(value / 10))));
    const shifted = rng.next() < 0.5 && value - delta >= 0 ? value - delta : value + delta;
    candidates.push(correct.replace(number[0], String(shifted)));
  }
  const offset = Math.floor(rng.next() * fallbackGuesses.length);
  for (let index = 0; index < fallbackGuesses.length; index += 1) {
    candidates.push(fallbackGuesses[(offset + index) % fallbackGuesses.length]);
  }
  return candidates.find((guess) => isClearlyWrong(guess, correct)) ?? "Atlantis";
}

/**
 * What each bot decided about the clue on screen, rolled once per clue.
 *
 * The room director re-reads the room on every state change. Without this,
 * a bot that "didn't know" would roll again on every join, presence change or
 * lockout, and its buzz rate would climb with room activity instead of
 * following its difficulty. The answer carries the buzz's knowledge, so a bot
 * that rang in because it knew mostly says the right thing.
 */
export class BotClueMemory {
  private readonly rng: BotRng;
  private clueId: string | undefined;
  private correctResponse: string | undefined;
  private readonly buzzes = new Map<string, BotBuzzDecision>();
  private readonly answers = new Map<string, BotAnswerDecision>();
  private readonly pastResponses: string[] = [];

  constructor(rng: BotRng) {
    this.rng = rng;
  }

  buzzFor(botId: string, profile: BotProfile, clue: GameClue): BotBuzzDecision {
    this.enter(clue);
    let decision = this.buzzes.get(botId);
    if (!decision) {
      decision = decideBotBuzz(profile, clue, this.rng);
      this.buzzes.set(botId, decision);
    }
    return decision;
  }

  answerFor(botId: string, profile: BotProfile, clue: GameClue): BotAnswerDecision {
    this.enter(clue);
    let decision = this.answers.get(botId);
    if (!decision) {
      decision = decideBotAnswer(profile, clue, this.rng, {
        knowsAnswer: this.buzzes.get(botId)?.knowsAnswer,
        distractors: this.pastResponses,
      });
      this.answers.set(botId, decision);
    }
    return decision;
  }

  private enter(clue: GameClue) {
    if (clue.id === this.clueId) return;
    if (this.correctResponse) {
      this.pastResponses.push(this.correctResponse);
      if (this.pastResponses.length > 60) this.pastResponses.shift();
    }
    this.clueId = clue.id;
    this.correctResponse = clue.correctResponse;
    this.buzzes.clear();
    this.answers.clear();
  }
}

export interface BotWagerInput {
  profile: BotProfile;
  clue: GameClue;
  currentScore: number;
  /**
   * The highest score in the room. Kept for older callers; it includes the
   * bot itself, so it can't tell a lead from a tie — prefer
   * `bestOpponentScore`.
   */
  leaderScore: number;
  /** The highest score among everyone else still in the game. */
  bestOpponentScore?: number;
  round: GameClue["round"];
  rng: BotRng;
}

/** A Final Jeopardy wager the way a sensible contestant makes it. Pure. */
export function decideFinalWager(
  profile: BotProfile,
  currentScore: number,
  bestOpponentScore: number,
): number {
  if (currentScore <= 0) return 0;
  const second = Math.max(0, bestOpponentScore);
  // A lock: nobody can catch up, so there is nothing to win by betting.
  if (currentScore > second * 2) return 0;
  if (currentScore >= second) {
    // Leading: bet enough to stay ahead of a doubled second place, plus a
    // margin the bolder bots are willing to risk.
    const cover = Math.min(currentScore, second * 2 - currentScore + 1);
    const spare = currentScore - cover;
    return Math.min(currentScore, cover + Math.floor(spare * profile.wagerAggression * 0.25));
  }
  // Trailing: bet at least enough to pass the leader, more for bolder bots.
  const needed = Math.min(currentScore, second - currentScore + 1);
  const bold = Math.floor(currentScore * (0.4 + profile.wagerAggression * 0.6));
  return Math.min(currentScore, Math.max(needed, bold));
}

export function decideBotWager({
  profile,
  clue,
  currentScore,
  leaderScore,
  bestOpponentScore,
  round,
  rng,
}: BotWagerInput): number {
  if (round === "final-jeopardy") {
    return decideFinalWager(profile, currentScore, bestOpponentScore ?? leaderScore);
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

function categoryBiasBoost(profile: BotProfile, clue: GameClue): number {
  if (!profile.categoryBias || profile.categoryBias.length === 0) return 0;
  const category = clue.category.toLowerCase();
  for (const tag of profile.categoryBias) {
    if (category.includes(tag.toLowerCase())) return 0.18;
  }
  return -0.05;
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
