import { describe, expect, it } from "vitest";
import {
  checkPublishedGame,
  generateGameId,
  publishedGameLimits,
  publishedGameToNormalized,
} from "@/lib/data/published-game";

const clue = {
  id: "c1",
  round: "jeopardy",
  category: "Maths",
  value: 200,
  clue: "Two plus two.",
  correctResponse: "What is four?",
};

describe("published custom games", () => {
  it("accepts a game someone actually typed", () => {
    const result = checkPublishedGame({ title: "Family quiz", clues: [clue] });
    expect(result.ok).toBe(true);
    expect(result.game?.title).toBe("Family quiz");
    expect(result.game?.clues).toHaveLength(1);
  });

  it("names what is missing rather than failing silently", () => {
    const result = checkPublishedGame({
      title: "",
      clues: [{ ...clue, clue: "", correctResponse: "" }],
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toMatch(/title/i);
    expect(result.problems.join(" ")).toMatch(/question/i);
    expect(result.problems.join(" ")).toMatch(/answer/i);
  });

  it("returns cleaned content, not the caller's object", () => {
    const result = checkPublishedGame({
      title: "  Spaced  ",
      clues: [{ ...clue, category: "  Maths  ", value: 200.7 }],
    });
    expect(result.game?.title).toBe("Spaced");
    expect(result.game?.clues[0].category).toBe("Maths");
    // Values land on the board as dollar amounts, not fractions.
    expect(result.game?.clues[0].value).toBe(201);
  });

  it("caps text so one clue cannot fill a board", () => {
    const result = checkPublishedGame({
      title: "x".repeat(500),
      clues: [{ ...clue, clue: "y".repeat(5_000) }],
    });
    expect(result.ok).toBe(true);
    expect(result.game?.title.length).toBe(publishedGameLimits.title);
    expect(result.game?.clues[0].clue.length).toBe(publishedGameLimits.clue);
  });

  it("refuses a game with more clues than a board could hold", () => {
    const result = checkPublishedGame({
      title: "Too big",
      clues: Array.from({ length: publishedGameLimits.clues + 5 }, (_, index) => ({
        ...clue,
        id: `c${index}`,
      })),
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toMatch(/at most/i);
  });

  it("keeps duplicate ids apart so two cells are never one clue", () => {
    const result = checkPublishedGame({
      title: "Twins",
      clues: [clue, { ...clue, clue: "A different question." }],
    });
    expect(result.ok).toBe(true);
    const ids = result.game?.clues.map((entry) => entry.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("falls back to a real round rather than trusting the wire", () => {
    const result = checkPublishedGame({
      title: "Odd round",
      clues: [{ ...clue, round: "not-a-round" }],
    });
    expect(result.ok).toBe(true);
    expect(result.game?.clues[0].round).toBe("jeopardy");
  });

  it("rejects anything that isn't a game at all", () => {
    expect(checkPublishedGame(null).ok).toBe(false);
    expect(checkPublishedGame("a game").ok).toBe(false);
    expect(checkPublishedGame({ title: "No clues", clues: [] }).ok).toBe(false);
  });

  it("mints ids that are unguessable, not merely unique", () => {
    const ids = new Set(Array.from({ length: 500 }, () => generateGameId()));
    expect(ids.size).toBe(500);
    for (const id of ids) {
      expect(id).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{10}$/);
    }
  });

  it("converts to something the lobby can play", () => {
    const checked = checkPublishedGame({ title: "Playable", id: "abc", clues: [clue] });
    const normalized = publishedGameToNormalized(checked.game!);
    expect(normalized.title).toBe("Playable");
    expect(normalized.clues[0].correctResponse).toBe("What is four?");
  });
});
