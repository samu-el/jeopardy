import type { GameClue, PlayableRound } from "@/lib/game";
import type { NormalizedGame } from "./contracts";

/**
 * A custom game as it travels between the builder, the Worker that stores it,
 * and whoever opens the share link.
 *
 * Everything here arrives from someone typing into a form, so the shape is
 * validated on the way in rather than trusted. The Worker runs exactly this
 * validator: a game that reaches storage is a game the app can play.
 */
export interface PublishedGame {
  /** Bumped when the stored shape changes, so old rows can be rejected. */
  version: number;
  id: string;
  title: string;
  author?: string;
  clues: GameClue[];
  createdAt: number;
  updatedAt: number;
}

export const publishedGameVersion = 1;

/**
 * Limits, so one person's game cannot fill a Durable Object or a screen.
 * A full two-round board is 60 clues; the ceiling leaves room for a third
 * round without leaving room for abuse.
 */
export const publishedGameLimits = {
  title: 120,
  author: 60,
  category: 80,
  clue: 600,
  response: 200,
  clues: 120,
  /** Serialized bytes, well under the per-value storage limit. */
  bytes: 128_000,
} as const;

const playableRounds: PlayableRound[] = [
  "jeopardy",
  "double-jeopardy",
  "triple-jeopardy",
  "final-jeopardy",
];

export type PublishedGameProblem = string;

export interface PublishedGameCheck {
  ok: boolean;
  problems: PublishedGameProblem[];
  game?: PublishedGame;
}

function trimmed(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Validates and normalises an inbound game. Returns the cleaned game rather
 * than the caller's object, so nothing unchecked is ever stored or played.
 */
export function checkPublishedGame(input: unknown): PublishedGameCheck {
  const problems: PublishedGameProblem[] = [];
  if (!isRecord(input)) {
    return { ok: false, problems: ["The game must be an object."] };
  }

  const title = trimmed(input.title, publishedGameLimits.title);
  if (!title) problems.push("A title is required.");

  const rawClues = Array.isArray(input.clues) ? input.clues : [];
  if (rawClues.length === 0) problems.push("A game needs at least one clue.");
  if (rawClues.length > publishedGameLimits.clues) {
    problems.push(`A game can hold at most ${publishedGameLimits.clues} clues.`);
  }

  const clues: GameClue[] = [];
  const seen = new Set<string>();
  rawClues.slice(0, publishedGameLimits.clues).forEach((entry, index) => {
    if (!isRecord(entry)) {
      problems.push(`Clue ${index + 1} is not an object.`);
      return;
    }
    const category = trimmed(entry.category, publishedGameLimits.category);
    const clue = trimmed(entry.clue, publishedGameLimits.clue);
    const correctResponse = trimmed(entry.correctResponse, publishedGameLimits.response);
    const round = playableRounds.includes(entry.round as PlayableRound)
      ? (entry.round as PlayableRound)
      : "jeopardy";
    const value = Number(entry.value);

    if (!category) problems.push(`Clue ${index + 1} needs a category.`);
    if (!clue) problems.push(`Clue ${index + 1} needs a question.`);
    if (!correctResponse) problems.push(`Clue ${index + 1} needs an answer.`);
    if (!Number.isFinite(value) || value < 0 || value > 100_000) {
      problems.push(`Clue ${index + 1} needs a value between 0 and 100000.`);
      return;
    }
    if (!category || !clue || !correctResponse) return;

    // Ids come from the client and are only unique by convention; a duplicate
    // would make two board cells the same clue.
    let id = trimmed(entry.id, 64) || `c-${index}`;
    while (seen.has(id)) id = `${id}-${index}`;
    seen.add(id);

    clues.push({
      id,
      round,
      category,
      value: Math.round(value),
      clue,
      correctResponse,
      dailyDouble: entry.dailyDouble === true,
    });
  });

  if (problems.length > 0) return { ok: false, problems };

  const now = Date.now();
  const game: PublishedGame = {
    version: publishedGameVersion,
    id: trimmed(input.id, 64) || "",
    title,
    author: trimmed(input.author, publishedGameLimits.author) || undefined,
    clues,
    createdAt: Number.isFinite(Number(input.createdAt)) ? Number(input.createdAt) : now,
    updatedAt: now,
  };

  if (JSON.stringify(game).length > publishedGameLimits.bytes) {
    return { ok: false, problems: ["That game is too large to publish."] };
  }
  return { ok: true, problems: [], game };
}

/** Turns a stored game back into something the lobby can play. */
export function publishedGameToNormalized(game: PublishedGame): NormalizedGame {
  return {
    id: game.id,
    source: "custom-csv",
    title: game.title,
    metadata: { title: game.title, notes: game.author ? `by ${game.author}` : undefined },
    clues: game.clues,
  };
}

// Unambiguous characters only: a game id gets read out and typed in.
const idAlphabet = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * Ten characters from a 31-character alphabet — roughly 50 bits. A share link
 * is the only thing protecting a game, so the id has to be unguessable rather
 * than merely unique.
 */
export function generateGameId(random: () => number = Math.random): string {
  let id = "";
  for (let index = 0; index < 10; index += 1) {
    id += idAlphabet[Math.floor(random() * idAlphabet.length)];
  }
  return id;
}
