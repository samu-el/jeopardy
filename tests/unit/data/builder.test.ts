import { describe, expect, it } from "vitest";
import {
  addCategory,
  addClueRow,
  buildNormalizedGame,
  builderCsvTemplate,
  builderGameToCsv,
  builderGameToJSON,
  builderProgress,
  categoriesForRound,
  emptyBuilderGame,
  importBuilderGame,
  isDraftTouched,
  parseBuilderGame,
  parseClueValue,
  removeCategory,
  removeClueRow,
  roundsInDraft,
  sortColumn,
  validateBuilderGame,
  type BuilderGame,
} from "@/lib/data";

function fill(game: BuilderGame, index: number, clue = "What is two plus two", answer = "four") {
  game.clues[index].clue = clue;
  game.clues[index].correctResponse = answer;
  return game;
}

function namedGame(): BuilderGame {
  const game = emptyBuilderGame();
  game.categories.forEach((category, index) => {
    category.name = `Topic ${index + 1}`;
  });
  return game;
}

describe("custom game builder", () => {
  it("produces a default skeleton with six columns per round", () => {
    const game = emptyBuilderGame();
    expect(categoriesForRound(game, "jeopardy")).toHaveLength(6);
    expect(categoriesForRound(game, "double-jeopardy")).toHaveLength(6);
    expect(game.clues).toHaveLength(60);
    expect(roundsInDraft(game)).toEqual(["jeopardy", "double-jeopardy"]);
  });

  it("rejects builder games with no real clues", () => {
    const result = buildNormalizedGame(emptyBuilderGame());
    expect(result.ok).toBe(false);
  });

  it("normalizes a filled-in builder game, warning about the holes", () => {
    const game = fill(emptyBuilderGame(), 0);
    const result = buildNormalizedGame(game);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.game.clues.length).toBe(1);
    expect(result.game.title).toBe(game.title);
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain("empty-cell");
    expect(codes).toContain("placeholder-name");
    expect(codes).toContain("missing-final");
    expect(codes).toContain("no-daily-double");
    expect(result.issues.every((issue) => issue.severity === "warning")).toBe(true);
  });

  it("names the round, column and value of a half-written clue", () => {
    const game = namedGame();
    const target = game.clues.find((clue) => clue.round === "double-jeopardy" && clue.value === 800)!;
    target.clue = "Something";
    const issues = validateBuilderGame(game);
    const missing = issues.find((issue) => issue.clueId === target.id);
    expect(missing?.severity).toBe("error");
    expect(missing?.field).toBe("correctResponse");
    expect(missing?.message).toMatch(/^Double Jeopardy › Topic 7 › \$800: answer missing/);
  });

  it("blocks duplicate category names within a round, not across rounds", () => {
    const game = fill(namedGame(), 0);
    game.categories[1].name = " topic 1 ";
    expect(validateBuilderGame(game).some((issue) => issue.code === "duplicate-category")).toBe(true);

    const across = fill(namedGame(), 0);
    across.categories[6].name = "Topic 1";
    expect(validateBuilderGame(across).some((issue) => issue.code === "duplicate-category")).toBe(
      false,
    );
  });

  it("caps Daily Doubles per round", () => {
    const game = namedGame();
    fill(game, 0);
    fill(game, 5);
    game.clues[0].dailyDouble = true;
    game.clues[5].dailyDouble = true;
    const issues = validateBuilderGame(game);
    expect(issues.find((issue) => issue.code === "too-many-daily-doubles")?.severity).toBe("error");
  });

  it("refuses text longer than publishing would keep", () => {
    const game = fill(namedGame(), 0, "x".repeat(700));
    const issue = validateBuilderGame(game).find((entry) => entry.code === "too-long");
    expect(issue?.field).toBe("clue");
  });

  it("requires every part of a started Final", () => {
    const game = fill(namedGame(), 0);
    game.finalClue = { category: "Science", clue: "", correctResponse: "" };
    const fields = validateBuilderGame(game)
      .filter((issue) => issue.round === "final-jeopardy" && issue.severity === "error")
      .map((issue) => issue.field);
    expect(fields).toEqual(["final.clue", "final.correctResponse"]);
  });

  it("reports progress", () => {
    const game = fill(fill(emptyBuilderGame(), 0), 1);
    expect(builderProgress(game)).toEqual({ complete: 2, total: 60, hasFinal: false });
  });

  it("adds and removes columns and rows", () => {
    let game = emptyBuilderGame();
    game = addCategory(game, "jeopardy");
    const added = categoriesForRound(game, "jeopardy");
    expect(added).toHaveLength(7);
    const newId = added[6].id;
    expect(game.clues.filter((clue) => clue.categoryId === newId)).toHaveLength(5);
    game = addClueRow(game, newId, "jeopardy");
    const column = game.clues.filter((clue) => clue.categoryId === newId);
    expect(column.at(-1)?.value).toBe(1200);
    game = removeClueRow(game, column[0].id);
    expect(game.clues.filter((clue) => clue.categoryId === newId)).toHaveLength(5);
    game = removeCategory(game, newId, "jeopardy");
    expect(categoriesForRound(game, "jeopardy")).toHaveLength(6);
    expect(game.clues.some((clue) => clue.categoryId === newId)).toBe(false);
  });

  it("sorts a column only when asked", () => {
    const game = emptyBuilderGame();
    game.clues[0].value = 1500;
    const sorted = sortColumn(game, game.clues[0].categoryId, "jeopardy");
    const values = sorted.clues
      .filter((clue) => clue.categoryId === game.clues[0].categoryId)
      .map((clue) => clue.value);
    expect(values).toEqual([400, 600, 800, 1000, 1500]);
  });

  it("parses typed values", () => {
    expect(parseClueValue("")).toBeUndefined();
    expect(parseClueValue("$1,500")).toBe(1500);
    expect(parseClueValue("-4")).toBeUndefined();
    expect(parseClueValue("abc")).toBeUndefined();
  });

  it("round trips JSON", () => {
    const game = emptyBuilderGame();
    game.title = "Round trip";
    game.publishedId = "abc";
    const round = parseBuilderGame(builderGameToJSON(game));
    expect(round?.title).toBe("Round trip");
    expect(round?.publishedId).toBe("abc");
    expect(round?.clues).toHaveLength(60);
  });

  it("returns null on unparseable JSON", () => {
    expect(parseBuilderGame("{not json")).toBeNull();
  });

  it("knows an untouched draft from a written one", () => {
    expect(isDraftTouched(emptyBuilderGame())).toBe(false);
    expect(isDraftTouched(fill(emptyBuilderGame(), 3))).toBe(true);
  });
});

describe("builder import", () => {
  it("refuses the wrong shape instead of crashing", () => {
    for (const source of [
      '{"categories":"x","clues":"y"}',
      "[]",
      "null",
      '"text"',
      '{"categories":[]}',
    ]) {
      const result = importBuilderGame(source, "shape.json");
      expect(result.ok, source).toBe(false);
      expect(result.issues[0].severity).toBe("error");
    }
  });

  it("coerces missing strings and reports dropped clues", () => {
    const result = importBuilderGame(
      JSON.stringify({
        categories: [{ id: "c1" }, 5],
        clues: [
          { id: "a", categoryId: "c1", round: "jeopardy", value: "400", clue: 7 },
          { id: "b", categoryId: "nope", round: "jeopardy", value: 200 },
          { id: "c", categoryId: "c1", round: "quadruple", value: 200 },
        ],
      }),
      "noname.json",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.game.categories).toEqual([{ id: "c1", name: "" }]);
    expect(result.game.clues).toHaveLength(1);
    expect(result.game.clues[0]).toMatchObject({ value: 400, clue: "7", correctResponse: "" });
    expect(result.issues.filter((issue) => issue.code === "dropped-clue")).toHaveLength(2);
    // Validating the coerced draft works rather than throwing.
    expect(() => validateBuilderGame(result.game)).not.toThrow();
  });

  it("reads a CSV, with rounds and categories per round", () => {
    const result = importBuilderGame(builderCsvTemplate(), "quiz.csv");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.game.title).toBe("quiz");
    expect(categoriesForRound(result.game, "jeopardy").map((c) => c.name)).toEqual([
      "Sea creatures",
    ]);
    expect(categoriesForRound(result.game, "double-jeopardy").map((c) => c.name)).toEqual([
      "Capitals",
    ]);
    expect(result.game.finalClue?.correctResponse).toBe("What is gold?");
    expect(result.game.clues.find((clue) => clue.value === 400 && clue.round === "jeopardy")?.dailyDouble).toBe(true);
  });

  it("surfaces row-numbered CSV problems", () => {
    const result = importBuilderGame("round,category,value,clue,answer\njeopardy,Cats,200,,Meow", "bad.csv");
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.row === 2)).toBe(true);
  });

  it("exports CSV that imports back", () => {
    const game = namedGame();
    fill(game, 0, "Clue, with comma", "Answer");
    game.finalClue = { category: "Fin", clue: "Q", correctResponse: "A" };
    const back = importBuilderGame(builderGameToCsv(game), "x.csv");
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.game.clues[0].clue).toBe("Clue, with comma");
    expect(back.game.finalClue?.category).toBe("Fin");
  });

  it("imports a played game's clue list", () => {
    const result = importBuilderGame(
      JSON.stringify({
        title: "Published",
        clues: [
          { round: "jeopardy", category: "A", value: 200, clue: "q", correctResponse: "a" },
          { round: "final-jeopardy", category: "F", value: 0, clue: "fq", correctResponse: "fa" },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.game.title).toBe("Published");
    expect(result.game.categories[0]).toMatchObject({ name: "A", round: "jeopardy" });
    expect(result.game.finalClue?.clue).toBe("fq");
  });

  it("keeps legacy shared columns working in both rounds", () => {
    const legacy: BuilderGame = {
      title: "Old",
      categories: [{ id: "cat-1", name: "Old names" }],
      clues: [
        { id: "j", categoryId: "cat-1", round: "jeopardy", value: 200, clue: "q", correctResponse: "a", dailyDouble: false },
        { id: "d", categoryId: "cat-1", round: "double-jeopardy", value: 400, clue: "q", correctResponse: "a", dailyDouble: false },
      ],
    };
    const result = buildNormalizedGame(legacy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.game.clues.map((clue) => clue.round)).toEqual(["jeopardy", "double-jeopardy"]);
  });
});
