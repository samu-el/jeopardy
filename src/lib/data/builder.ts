import Papa from "papaparse";
import { roundNames, type GameClue, type PlayableRound } from "@/lib/game";
import type {
  GameDataIssue,
  GameDataNormalizationResult,
  NormalizedGame,
} from "./contracts";
import { normalizeCustomCsvGame } from "./normalize";
import { publishedGameLimits } from "./published-game";

export interface BuilderCategory {
  id: string;
  name: string;
  /**
   * The round this column belongs to. Drafts written before categories were
   * per round have none, and such a column appears in every board round.
   */
  round?: BoardRound;
}

export interface BuilderClue {
  id: string;
  categoryId: string;
  round: PlayableRound;
  value: number;
  clue: string;
  correctResponse: string;
  dailyDouble: boolean;
}

export interface BuilderGame {
  title: string;
  categories: BuilderCategory[];
  clues: BuilderClue[];
  finalClue?: { category: string; clue: string; correctResponse: string };
  /** The share id this draft was last published under, so Publish updates it. */
  publishedId?: string;
}

/** The rounds a builder column can sit in. Final is its own single clue. */
export type BoardRound = Exclude<PlayableRound, "final-jeopardy">;

export const boardRounds: BoardRound[] = ["jeopardy", "double-jeopardy", "triple-jeopardy"];

const valuesByRound: Record<BoardRound, number[]> = {
  jeopardy: [200, 400, 600, 800, 1000],
  "double-jeopardy": [400, 800, 1200, 1600, 2000],
  "triple-jeopardy": [600, 1200, 1800, 2400, 3000],
};

/** How many Daily Doubles a round may hide, the way the show deals them. */
export const dailyDoubleLimits: Record<BoardRound, number> = {
  jeopardy: 1,
  "double-jeopardy": 2,
  "triple-jeopardy": 3,
};

/** The builder refuses what publishing would otherwise silently cut. */
export const builderLimits = {
  title: publishedGameLimits.title,
  category: publishedGameLimits.category,
  clue: publishedGameLimits.clue,
  response: publishedGameLimits.response,
  categoriesPerRound: 8,
  cluesPerCategory: 8,
  maxValue: 100_000,
} as const;

export function defaultValuesForRound(round: PlayableRound): number[] {
  if (round === "final-jeopardy") return [0];
  return valuesByRound[round];
}

export function emptyBuilderGame(): BuilderGame {
  const categories: BuilderCategory[] = [];
  const clues: BuilderClue[] = [];
  for (const round of ["jeopardy", "double-jeopardy"] as const) {
    for (let index = 0; index < 6; index += 1) {
      const category = newCategory(round, index + 1, `${round}-cat-${index + 1}`);
      categories.push(category);
      clues.push(...emptyColumn(round, category.id));
    }
  }
  return { title: "My custom game", categories, clues };
}

function newCategory(round: BoardRound, position: number, id: string): BuilderCategory {
  return { id, name: `Category ${position}`, round };
}

function emptyColumn(round: BoardRound, categoryId: string): BuilderClue[] {
  return defaultValuesForRound(round).map((value, index) => ({
    id: `${categoryId}-${index + 1}`,
    categoryId,
    round,
    value,
    clue: "",
    correctResponse: "",
    dailyDouble: false,
  }));
}

/** The columns a round shows, in the order they were written. */
export function categoriesForRound(game: BuilderGame, round: BoardRound): BuilderCategory[] {
  return game.categories.filter((category) => !category.round || category.round === round);
}

/** The rounds the builder offers a tab for: the usual two, plus any a draft brings. */
export function roundsInDraft(game: BuilderGame): BoardRound[] {
  return boardRounds.filter(
    (round) =>
      round !== "triple-jeopardy" ||
      game.categories.some((category) => category.round === round) ||
      game.clues.some((clue) => clue.round === round),
  );
}

function uniqueId(prefix: string, taken: Set<string>): string {
  let index = taken.size + 1;
  while (taken.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

/** Adds an empty column to a round, with a full set of empty rows. */
export function addCategory(game: BuilderGame, round: BoardRound): BuilderGame {
  const taken = new Set(game.categories.map((category) => category.id));
  const id = uniqueId(`${round}-cat`, taken);
  const position = categoriesForRound(game, round).length + 1;
  return {
    ...game,
    categories: [...game.categories, newCategory(round, position, id)],
    clues: [...game.clues, ...emptyColumn(round, id)],
  };
}

/** Removes a column and every clue it holds in that round. */
export function removeCategory(
  game: BuilderGame,
  categoryId: string,
  round: BoardRound,
): BuilderGame {
  const category = game.categories.find((entry) => entry.id === categoryId);
  if (!category) return game;
  const clues = game.clues.filter(
    (clue) => !(clue.categoryId === categoryId && clue.round === round),
  );
  // A legacy column shared across rounds survives in the rounds it still has.
  const stillUsed = !category.round && clues.some((clue) => clue.categoryId === categoryId);
  return {
    ...game,
    categories: stillUsed
      ? game.categories
      : game.categories.filter((entry) => entry.id !== categoryId),
    clues,
  };
}

/** Adds a row under a column, one step above its current top value. */
export function addClueRow(
  game: BuilderGame,
  categoryId: string,
  round: BoardRound,
): BuilderGame {
  const column = game.clues.filter(
    (clue) => clue.categoryId === categoryId && clue.round === round,
  );
  const step = defaultValuesForRound(round)[0];
  const top = column.reduce((max, clue) => Math.max(max, clue.value), 0);
  const taken = new Set(game.clues.map((clue) => clue.id));
  const clue: BuilderClue = {
    id: uniqueId(`${categoryId}-${round}`, taken),
    categoryId,
    round,
    value: Math.min(top + step, builderLimits.maxValue),
    clue: "",
    correctResponse: "",
    dailyDouble: false,
  };
  return { ...game, clues: [...game.clues, clue] };
}

export function removeClueRow(game: BuilderGame, clueId: string): BuilderGame {
  return { ...game, clues: game.clues.filter((clue) => clue.id !== clueId) };
}

/**
 * Puts one column's rows back in value order. Called when a value is
 * committed, never per keystroke, so a row doesn't jump while it's typed in.
 */
export function sortColumn(
  game: BuilderGame,
  categoryId: string,
  round: PlayableRound,
): BuilderGame {
  const inColumn = (clue: BuilderClue) => clue.categoryId === categoryId && clue.round === round;
  const sorted = game.clues.filter(inColumn).sort((a, b) => a.value - b.value);
  let next = 0;
  return {
    ...game,
    clues: game.clues.map((clue) => (inColumn(clue) ? sorted[next++] : clue)),
  };
}

/** Parses a typed dollar value; undefined when it isn't one. */
export function parseClueValue(input: string): number | undefined {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!cleaned) return undefined;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return Math.min(Math.round(value), builderLimits.maxValue);
}

const placeholderName = /^category \d+$/i;

function isFilled(clue: BuilderClue): boolean {
  return Boolean(clue.clue.trim() || clue.correctResponse.trim());
}

function isComplete(clue: BuilderClue): boolean {
  return Boolean(clue.clue.trim() && clue.correctResponse.trim());
}

function roundLabel(round: PlayableRound): string {
  return roundNames[round].plain;
}

/** How much of the board is written, for the summary above the fields. */
export function builderProgress(game: BuilderGame): {
  complete: number;
  total: number;
  hasFinal: boolean;
} {
  const rounds = new Set<PlayableRound>(roundsInDraft(game));
  const known = new Set(game.categories.map((category) => category.id));
  const cells = game.clues.filter((clue) => rounds.has(clue.round) && known.has(clue.categoryId));
  const final = game.finalClue;
  return {
    complete: cells.filter(isComplete).length,
    total: cells.length,
    hasFinal: Boolean(
      final && final.category.trim() && final.clue.trim() && final.correctResponse.trim(),
    ),
  };
}

function tooLong(
  issues: GameDataIssue[],
  text: string,
  limit: number,
  where: string,
  detail: Pick<GameDataIssue, "clueId" | "categoryId" | "round" | "field">,
) {
  if (text.length <= limit) return;
  issues.push({
    severity: "error",
    code: "too-long",
    message: `${where}: ${text.length} characters, the limit is ${limit}.`,
    ...detail,
  });
}

/**
 * Everything wrong with a draft, each problem naming the round, the column
 * and the value it sits under, so the builder can point at the input.
 *
 * Errors block playing and publishing; warnings are things a person may mean
 * (an unfinished column, no Final) and are asked about rather than refused.
 */
export function validateBuilderGame(game: BuilderGame): GameDataIssue[] {
  const issues: GameDataIssue[] = [];
  tooLong(issues, game.title.trim(), builderLimits.title, "Title", { field: "title" });

  const rounds = roundsInDraft(game);
  const known = new Set(game.categories.map((category) => category.id));

  for (const round of rounds) {
    const seenNames = new Map<string, string>();
    let dailyDoubles = 0;
    let roundHasClues = false;
    categoriesForRound(game, round).forEach((category, index) => {
      const name = category.name.trim();
      const label = name || `Category ${index + 1}`;
      const where = `${roundLabel(round)} › ${label}`;
      const column = game.clues.filter(
        (clue) => clue.categoryId === category.id && clue.round === round,
      );
      const filled = column.filter(isFilled);
      if (filled.length > 0) roundHasClues = true;
      const at = { categoryId: category.id, round, field: "name" } as const;

      if (!name) {
        issues.push({
          severity: filled.length > 0 ? "error" : "warning",
          code: filled.length > 0 ? "missing-field" : "empty-category",
          message:
            filled.length > 0
              ? `${where}: the category needs a name.`
              : `${where}: no name and no clues, so it will be left off the board.`,
          ...at,
        });
      } else {
        const key = name.toLowerCase();
        if (seenNames.has(key)) {
          issues.push({
            severity: "error",
            code: "duplicate-category",
            message: `${where}: another ${roundLabel(round)} category is already called "${seenNames.get(key)}". Names must differ within a round.`,
            ...at,
          });
        } else {
          seenNames.set(key, name);
        }
        tooLong(issues, name, builderLimits.category, `${where} name`, at);
        if (filled.length > 0 && placeholderName.test(name)) {
          issues.push({
            severity: "warning",
            code: "placeholder-name",
            message: `${where}: still has its placeholder name.`,
            ...at,
          });
        }
        if (filled.length === 0) {
          issues.push({
            severity: "warning",
            code: "empty-category",
            message: `${where}: no clues yet, so it will be left off the board.`,
            ...at,
          });
        }
      }

      for (const clue of column) {
        const cell = `${where} › $${clue.value}`;
        const text = clue.clue.trim();
        const answer = clue.correctResponse.trim();
        const here = { clueId: clue.id, categoryId: category.id, round };
        if (!Number.isFinite(clue.value) || clue.value < 0 || clue.value > builderLimits.maxValue) {
          issues.push({
            severity: "error",
            code: "invalid-value",
            message: `${cell}: the value must be between $0 and $${builderLimits.maxValue.toLocaleString("en-US")}.`,
            field: "value",
            ...here,
          });
        }
        if (!text && !answer) continue;
        if (!text) {
          issues.push({
            severity: "error",
            code: "missing-field",
            message: `${cell}: clue text missing.`,
            field: "clue",
            ...here,
          });
        }
        if (!answer) {
          issues.push({
            severity: "error",
            code: "missing-field",
            message: `${cell}: answer missing.`,
            field: "correctResponse",
            ...here,
          });
        }
        tooLong(issues, text, builderLimits.clue, `${cell} clue`, { ...here, field: "clue" });
        tooLong(issues, answer, builderLimits.response, `${cell} answer`, {
          ...here,
          field: "correctResponse",
        });
        if (clue.dailyDouble) dailyDoubles += 1;
      }

      const empty = column.length - filled.length;
      if (filled.length > 0 && empty > 0) {
        issues.push({
          severity: "warning",
          code: "empty-cell",
          message: `${where}: ${empty} empty ${empty === 1 ? "cell" : "cells"} will show as blanks on the board.`,
          categoryId: category.id,
          round,
        });
      }
    });

    const limit = dailyDoubleLimits[round];
    if (dailyDoubles > limit) {
      issues.push({
        severity: "error",
        code: "too-many-daily-doubles",
        message: `${roundLabel(round)}: ${dailyDoubles} Daily Doubles, at most ${limit} allowed.`,
        round,
        field: "dailyDouble",
      });
    } else if (roundHasClues && dailyDoubles === 0) {
      issues.push({
        severity: "warning",
        code: "no-daily-double",
        message: `${roundLabel(round)}: no Daily Double. Tick one on any clue to hide it there.`,
        round,
        field: "dailyDouble",
      });
    }
  }

  const orphans = game.clues.filter((clue) => !known.has(clue.categoryId) && isFilled(clue));
  const offBoard = game.clues.filter(
    (clue) =>
      known.has(clue.categoryId) &&
      isFilled(clue) &&
      !rounds.includes(clue.round as BoardRound),
  );
  if (orphans.length > 0) {
    issues.push({
      severity: "warning",
      code: "dropped-clue",
      message: `${orphans.length} ${orphans.length === 1 ? "clue belongs" : "clues belong"} to no category and will be dropped.`,
    });
  }
  if (offBoard.length > 0) {
    issues.push({
      severity: "warning",
      code: "dropped-clue",
      message: `${offBoard.length} ${offBoard.length === 1 ? "clue is" : "clues are"} in a round the board can't show and will be dropped.`,
    });
  }

  const final = game.finalClue;
  const finalParts = {
    category: final?.category.trim() ?? "",
    clue: final?.clue.trim() ?? "",
    correctResponse: final?.correctResponse.trim() ?? "",
  };
  if (!finalParts.category && !finalParts.clue && !finalParts.correctResponse) {
    issues.push({
      severity: "warning",
      code: "missing-final",
      message: "No Final Jeopardy: the game will end after the last round.",
      round: "final-jeopardy",
    });
  } else {
    const missing = (
      [
        ["category", "category"],
        ["clue", "clue"],
        ["correctResponse", "answer"],
      ] as const
    ).filter(([key]) => !finalParts[key]);
    for (const [key, label] of missing) {
      issues.push({
        severity: "error",
        code: "missing-field",
        message: `Final Jeopardy: ${label} missing.`,
        round: "final-jeopardy",
        field: `final.${key}`,
      });
    }
    tooLong(issues, finalParts.category, builderLimits.category, "Final Jeopardy category", {
      round: "final-jeopardy",
      field: "final.category",
    });
    tooLong(issues, finalParts.clue, builderLimits.clue, "Final Jeopardy clue", {
      round: "final-jeopardy",
      field: "final.clue",
    });
    tooLong(issues, finalParts.correctResponse, builderLimits.response, "Final Jeopardy answer", {
      round: "final-jeopardy",
      field: "final.correctResponse",
    });
  }

  const anyComplete = game.clues.some(
    (clue) => known.has(clue.categoryId) && rounds.includes(clue.round as BoardRound) && isComplete(clue),
  );
  if (!anyComplete) {
    issues.push({
      severity: "error",
      code: "empty-input",
      message: "Add at least one complete clue (clue and answer) before playing.",
    });
  }
  return issues;
}

export function buildNormalizedGame(game: BuilderGame): GameDataNormalizationResult {
  const issues = validateBuilderGame(game);
  if (issues.some((issue) => issue.severity === "error")) {
    return { ok: false, issues };
  }

  const clues: GameClue[] = [];
  for (const round of roundsInDraft(game)) {
    for (const category of categoriesForRound(game, round)) {
      const name = category.name.trim();
      if (!name) continue;
      for (const clue of game.clues) {
        if (clue.categoryId !== category.id || clue.round !== round || !isComplete(clue)) {
          continue;
        }
        clues.push({
          id: clue.id,
          round,
          category: name,
          value: clue.value,
          clue: clue.clue.trim(),
          correctResponse: clue.correctResponse.trim(),
          dailyDouble: clue.dailyDouble || undefined,
        });
      }
    }
  }
  const final = game.finalClue;
  if (final && final.category.trim() && final.clue.trim() && final.correctResponse.trim()) {
    clues.push({
      id: "final-1",
      round: "final-jeopardy",
      category: final.category.trim(),
      value: 0,
      clue: final.clue.trim(),
      correctResponse: final.correctResponse.trim(),
    });
  }

  const normalized: NormalizedGame = {
    id: `builder-${Math.random().toString(36).slice(2, 10)}`,
    source: "custom-csv",
    title: game.title.trim() || "Custom game",
    metadata: { title: game.title.trim() || undefined },
    clues,
  };
  return { ok: true, game: normalized, issues };
}

export function builderGameToJSON(game: BuilderGame): string {
  return JSON.stringify(game, null, 2);
}

/** The columns a CSV import reads, in the order the template writes them. */
export const builderCsvColumns = ["round", "category", "value", "clue", "answer", "dd"] as const;

export function builderGameToCsv(game: BuilderGame): string {
  const rows: string[][] = [];
  for (const round of roundsInDraft(game)) {
    for (const category of categoriesForRound(game, round)) {
      for (const clue of game.clues) {
        if (clue.categoryId !== category.id || clue.round !== round || !isFilled(clue)) continue;
        rows.push([
          round,
          category.name,
          String(clue.value),
          clue.clue,
          clue.correctResponse,
          clue.dailyDouble ? "yes" : "",
        ]);
      }
    }
  }
  const final = game.finalClue;
  if (final && (final.category || final.clue || final.correctResponse)) {
    rows.push(["final", final.category, "0", final.clue, final.correctResponse, ""]);
  }
  return Papa.unparse({ fields: [...builderCsvColumns], data: rows });
}

/** A short example file, so the expected columns are shown rather than described. */
export function builderCsvTemplate(): string {
  return Papa.unparse({
    fields: [...builderCsvColumns],
    data: [
      ["jeopardy", "Sea creatures", "200", "It has eight arms.", "What is an octopus?", ""],
      ["jeopardy", "Sea creatures", "400", "The largest animal ever known.", "What is the blue whale?", "yes"],
      ["double", "Capitals", "400", "Canberra is the capital of it.", "What is Australia?", ""],
      ["final", "Science", "0", "Its symbol is Au.", "What is gold?", ""],
    ],
  });
}

export type BuilderImportResult =
  | { ok: true; game: BuilderGame; issues: GameDataIssue[] }
  | { ok: false; issues: GameDataIssue[] };

function shapeError(message: string): BuilderImportResult {
  return { ok: false, issues: [{ severity: "error", code: "invalid-shape", message }] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

const knownRounds = new Set<PlayableRound>([...boardRounds, "final-jeopardy"]);

/**
 * Turns played clues (a CSV, an exported or published game) back into a
 * draft: one column per round and category name, in first-seen order.
 */
export function builderGameFromClues(clues: GameClue[], title = "Imported game"): BuilderGame {
  const categories: BuilderCategory[] = [];
  const builderClues: BuilderClue[] = [];
  const columns = new Map<string, string>();
  let finalClue: BuilderGame["finalClue"];
  clues.forEach((clue, index) => {
    if (clue.round === "final-jeopardy") {
      finalClue ??= {
        category: clue.category,
        clue: clue.clue,
        correctResponse: clue.correctResponse,
      };
      return;
    }
    const key = `${clue.round}:${clue.category.trim().toLowerCase()}`;
    let categoryId = columns.get(key);
    if (!categoryId) {
      categoryId = `${clue.round}-cat-${columns.size + 1}`;
      columns.set(key, categoryId);
      categories.push({ id: categoryId, name: clue.category.trim(), round: clue.round });
    }
    builderClues.push({
      id: `${categoryId}-${index + 1}`,
      categoryId,
      round: clue.round,
      value: clue.value,
      clue: clue.clue,
      correctResponse: clue.correctResponse,
      dailyDouble: Boolean(clue.dailyDouble),
    });
  });
  let game: BuilderGame = { title, categories, clues: builderClues, finalClue };
  for (const category of categories) {
    game = sortColumn(game, category.id, category.round ?? "jeopardy");
  }
  return game;
}

/**
 * Checks an imported draft field by field instead of trusting its shape.
 * Missing strings become empty ones; anything that can't be placed on the
 * board is reported and left out, never passed on to crash the form.
 */
export function coerceBuilderGame(input: unknown): BuilderImportResult {
  if (!isRecord(input)) return shapeError("The file must hold a game object.");
  const issues: GameDataIssue[] = [];
  const title = text(input.title).trim() || "Imported game";

  // A played or published game: clues carry category names, not columns.
  if (!Array.isArray(input.categories) && Array.isArray(input.clues)) {
    const clues: GameClue[] = [];
    input.clues.forEach((entry, index) => {
      const round = isRecord(entry) ? (entry.round as PlayableRound) : undefined;
      if (!isRecord(entry) || !round || !knownRounds.has(round) || !text(entry.category).trim()) {
        issues.push({
          severity: "warning",
          code: "dropped-clue",
          message: `Clue ${index + 1} has no usable round or category and was dropped.`,
          row: index + 1,
        });
        return;
      }
      const value = Number(entry.value);
      clues.push({
        id: `c-${index + 1}`,
        round,
        category: text(entry.category).trim(),
        value: Number.isFinite(value) && value >= 0 ? value : 0,
        clue: text(entry.clue),
        correctResponse: text(entry.correctResponse ?? entry.answer),
        dailyDouble: entry.dailyDouble === true,
      });
    });
    if (clues.length === 0) return { ok: false, issues: [...issues, ...shapeError("The file has no clues the builder can read.").issues] };
    return { ok: true, game: builderGameFromClues(clues, title), issues };
  }

  if (!Array.isArray(input.categories)) {
    return shapeError('The file needs a "categories" list and a "clues" list.');
  }
  if (!Array.isArray(input.clues)) {
    return shapeError('The file needs a "clues" list.');
  }

  const categories: BuilderCategory[] = [];
  const categoryIds = new Set<string>();
  input.categories.forEach((entry, index) => {
    if (!isRecord(entry)) {
      issues.push({
        severity: "warning",
        code: "invalid-shape",
        message: `Category ${index + 1} is not an object and was skipped.`,
      });
      return;
    }
    let id = text(entry.id).trim() || `cat-${index + 1}`;
    while (categoryIds.has(id)) id = `${id}-${index + 1}`;
    categoryIds.add(id);
    const round = boardRounds.includes(entry.round as BoardRound)
      ? (entry.round as BoardRound)
      : undefined;
    categories.push({ id, name: text(entry.name), ...(round ? { round } : {}) });
  });

  const clues: BuilderClue[] = [];
  const clueIds = new Set<string>();
  let orphaned = 0;
  let unsupported = 0;
  input.clues.forEach((entry, index) => {
    if (!isRecord(entry)) {
      orphaned += 1;
      return;
    }
    const categoryId = text(entry.categoryId);
    if (!categoryIds.has(categoryId)) {
      orphaned += 1;
      return;
    }
    const round = entry.round as BoardRound;
    if (!boardRounds.includes(round)) {
      unsupported += 1;
      return;
    }
    let id = text(entry.id).trim() || `clue-${index + 1}`;
    while (clueIds.has(id)) id = `${id}-${index + 1}`;
    clueIds.add(id);
    const value = Number(entry.value);
    if (!Number.isFinite(value) || value < 0) {
      issues.push({
        severity: "warning",
        code: "invalid-value",
        message: `Clue ${index + 1} had no usable value and was set to $0.`,
        clueId: id,
      });
    }
    clues.push({
      id,
      categoryId,
      round,
      value: Number.isFinite(value) && value >= 0 ? Math.round(value) : 0,
      clue: text(entry.clue),
      correctResponse: text(entry.correctResponse),
      dailyDouble: entry.dailyDouble === true,
    });
  });
  if (orphaned > 0) {
    issues.push({
      severity: "warning",
      code: "dropped-clue",
      message: `${orphaned} ${orphaned === 1 ? "clue" : "clues"} pointed at no category and ${orphaned === 1 ? "was" : "were"} dropped.`,
    });
  }
  if (unsupported > 0) {
    issues.push({
      severity: "warning",
      code: "dropped-clue",
      message: `${unsupported} ${unsupported === 1 ? "clue" : "clues"} had an unknown round and ${unsupported === 1 ? "was" : "were"} dropped.`,
    });
  }

  let finalClue: BuilderGame["finalClue"];
  if (isRecord(input.finalClue)) {
    finalClue = {
      category: text(input.finalClue.category),
      clue: text(input.finalClue.clue),
      correctResponse: text(input.finalClue.correctResponse),
    };
  }
  const publishedId = text(input.publishedId).trim() || undefined;
  return {
    ok: true,
    game: {
      title,
      categories,
      clues,
      ...(finalClue ? { finalClue } : {}),
      ...(publishedId ? { publishedId } : {}),
    },
    issues,
  };
}

/**
 * Reads an imported file — builder JSON, an exported game, or a CSV — into a
 * draft, with every problem it found. Never throws.
 */
export function importBuilderGame(source: string, fileName = ""): BuilderImportResult {
  const trimmedSource = source.trim();
  if (!trimmedSource) {
    return { ok: false, issues: [{ severity: "error", code: "empty-input", message: "The file is empty." }] };
  }
  const looksJson = /\.json$/i.test(fileName) || /^[[{]/.test(trimmedSource);
  if (!looksJson) {
    const result = normalizeCustomCsvGame(source);
    if (!result.ok) return { ok: false, issues: result.issues };
    const title = fileName.replace(/\.[^.]+$/, "").trim() || "Imported game";
    return { ok: true, game: builderGameFromClues(result.game.clues, title), issues: result.issues };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return shapeError("That file isn't valid JSON. Export a game from the builder, or use a CSV.");
  }
  return coerceBuilderGame(parsed);
}

/** A draft from JSON, or null when it can't be read. Kept for old callers. */
export function parseBuilderGame(json: string): BuilderGame | null {
  const result = importBuilderGame(json, "draft.json");
  return result.ok ? result.game : null;
}

/** A draft someone has typed into, so replacing it deserves a question. */
export function isDraftTouched(game: BuilderGame): boolean {
  const fresh = emptyBuilderGame();
  if (game.title.trim() && game.title !== fresh.title) return true;
  if (game.clues.some(isFilled)) return true;
  if (game.finalClue && (game.finalClue.category || game.finalClue.clue || game.finalClue.correctResponse)) {
    return true;
  }
  return game.categories.some((category) => category.name.trim() && !placeholderName.test(category.name.trim()));
}
