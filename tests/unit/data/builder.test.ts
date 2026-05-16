import { describe, expect, it } from "vitest";
import {
  buildNormalizedGame,
  builderGameToJSON,
  emptyBuilderGame,
  parseBuilderGame,
} from "@/lib/data";

describe("custom game builder", () => {
  it("produces a default skeleton with categories and empty clues", () => {
    const game = emptyBuilderGame();
    expect(game.categories.length).toBe(6);
    expect(game.clues.length).toBeGreaterThan(0);
  });

  it("rejects builder games with no real clues", () => {
    const game = emptyBuilderGame();
    const result = buildNormalizedGame(game);
    expect(result.ok).toBe(false);
  });

  it("normalizes a filled-in builder game", () => {
    const game = emptyBuilderGame();
    const clue = game.clues[0];
    clue.clue = "What is two plus two";
    clue.correctResponse = "four";
    const result = buildNormalizedGame(game);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.game.clues.length).toBe(1);
    expect(result.game.title).toBe(game.title);
  });

  it("round trips JSON", () => {
    const game = emptyBuilderGame();
    game.title = "Round trip";
    const round = parseBuilderGame(builderGameToJSON(game));
    expect(round?.title).toBe("Round trip");
  });

  it("returns null on unparseable JSON", () => {
    expect(parseBuilderGame("{not json")).toBeNull();
  });
});
