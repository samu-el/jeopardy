import type { GameClue, PlayableRound } from "@/lib/game";
import type {
  GameDataIssue,
  GameDataNormalizationResult,
  NormalizedGame,
} from "./contracts";

export interface BuilderCategory {
  id: string;
  name: string;
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
}

const valuesByRound: Record<Exclude<PlayableRound, "final-jeopardy">, number[]> = {
  jeopardy: [200, 400, 600, 800, 1000],
  "double-jeopardy": [400, 800, 1200, 1600, 2000],
  "triple-jeopardy": [600, 1200, 1800, 2400, 3000],
};

export function defaultValuesForRound(round: PlayableRound): number[] {
  if (round === "final-jeopardy") return [0];
  return valuesByRound[round];
}

export function emptyBuilderGame(): BuilderGame {
  return {
    title: "My custom game",
    categories: defaultCategories(),
    clues: defaultClues(),
  };
}

function defaultCategories(): BuilderCategory[] {
  return Array.from({ length: 6 }, (_, index) => ({
    id: `cat-${index + 1}`,
    name: `Category ${index + 1}`,
  }));
}

function defaultClues(): BuilderClue[] {
  const clues: BuilderClue[] = [];
  for (const round of ["jeopardy", "double-jeopardy"] as const) {
    const values = defaultValuesForRound(round);
    for (let catIndex = 0; catIndex < 6; catIndex += 1) {
      for (let valueIndex = 0; valueIndex < values.length; valueIndex += 1) {
        clues.push({
          id: `${round}-${catIndex + 1}-${valueIndex + 1}`,
          categoryId: `cat-${catIndex + 1}`,
          round,
          value: values[valueIndex],
          clue: "",
          correctResponse: "",
          dailyDouble: false,
        });
      }
    }
  }
  return clues;
}

export function buildNormalizedGame(
  game: BuilderGame,
): GameDataNormalizationResult {
  const issues: GameDataIssue[] = [];
  const clues: GameClue[] = [];
  const catNames = new Map<string, string>();
  for (const cat of game.categories) {
    const name = cat.name.trim();
    if (!name) {
      issues.push({
        severity: "error",
        code: "missing-field",
        message: "Every category needs a name.",
        field: "category",
      });
      continue;
    }
    catNames.set(cat.id, name);
  }
  for (const clue of game.clues) {
    const category = catNames.get(clue.categoryId);
    if (!category) continue;
    const text = clue.clue.trim();
    const answer = clue.correctResponse.trim();
    if (!text && !answer) continue;
    if (!text) {
      issues.push({
        severity: "error",
        code: "missing-field",
        message: `Missing clue text in ${category}.`,
        field: "clue",
      });
      continue;
    }
    if (!answer) {
      issues.push({
        severity: "error",
        code: "missing-field",
        message: `Missing answer in ${category}.`,
        field: "answer",
      });
      continue;
    }
    clues.push({
      id: `${clue.id}`,
      round: clue.round,
      category,
      value: Number.isFinite(clue.value) && clue.value >= 0 ? clue.value : 0,
      clue: text,
      correctResponse: answer,
      dailyDouble: clue.dailyDouble || undefined,
    });
  }

  if (game.finalClue) {
    const text = game.finalClue.clue.trim();
    const answer = game.finalClue.correctResponse.trim();
    const category = game.finalClue.category.trim();
    if (text || answer || category) {
      if (!text || !answer || !category) {
        issues.push({
          severity: "error",
          code: "missing-field",
          message: "Final Jeopardy needs a category, clue, and answer.",
          field: "final",
        });
      } else {
        clues.push({
          id: "final-1",
          round: "final-jeopardy",
          category,
          value: 0,
          clue: text,
          correctResponse: answer,
        });
      }
    }
  }

  if (clues.length === 0) {
    issues.push({
      severity: "error",
      code: "empty-input",
      message: "Add at least one complete clue before launching.",
    });
  }

  if (issues.some((issue) => issue.severity === "error")) {
    return { ok: false, issues };
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

export function parseBuilderGame(json: string): BuilderGame | null {
  try {
    const parsed = JSON.parse(json) as BuilderGame;
    if (!parsed.categories || !parsed.clues) return null;
    return parsed;
  } catch {
    return null;
  }
}
