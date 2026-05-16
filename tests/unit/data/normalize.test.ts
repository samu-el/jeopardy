import { describe, expect, it } from "vitest";
import {
  normalizeArchivedEpisode,
  normalizeCustomCsvGame,
  type ArchivedEpisodeInput,
} from "@/lib/data";

describe("game data normalization", () => {
  it("normalizes archived episode data into engine clues", () => {
    const episode: ArchivedEpisodeInput = {
      epNum: "9001",
      airDate: "2026-05-16",
      info: "Tournament final",
      jeopardy: [
        {
          x: 1,
          y: 1,
          cat: "Planets",
          q: "The red planet.",
          a: "Mars",
          val: 200,
        },
      ],
      double: [
        {
          x: 2,
          y: 3,
          cat: "Math",
          q: "Six times seven.",
          a: "Forty-two",
          dd: true,
        },
      ],
      final: [
        {
          cat: "Computing",
          q: "This person is credited with the first published computer program.",
          a: "Ada Lovelace",
        },
      ],
    };

    const result = normalizeArchivedEpisode(episode);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.game.metadata).toMatchObject({
      episodeNumber: "9001",
      airDate: "2026-05-16",
      notes: "Tournament final",
    });
    expect(result.game.clues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "jeopardy-1-1",
          round: "jeopardy",
          category: "Planets",
          value: 200,
          clue: "The red planet.",
          correctResponse: "Mars",
        }),
        expect.objectContaining({
          id: "double-jeopardy-2-3",
          round: "double-jeopardy",
          value: 1_200,
          dailyDouble: true,
        }),
        expect.objectContaining({
          round: "final-jeopardy",
          value: 0,
        }),
      ]),
    );
    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("normalizes upstream-style custom CSV rows", () => {
    const csv = [
      "round,cat,q,a,dd",
      "jeopardy,Potpourri,First clue,First answer,false",
      "jeopardy,Potpourri,Second clue,Second answer,true",
      "double,Science,Heaviest noble gas,Oganesson,false",
      "final,History,Final clue,Final answer,false",
    ].join("\n");

    const result = normalizeCustomCsvGame(csv, {
      id: "custom-1",
      title: "Practice board",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.game).toMatchObject({
      id: "custom-1",
      source: "custom-csv",
      title: "Practice board",
    });
    expect(result.game.clues).toEqual([
      expect.objectContaining({
        round: "jeopardy",
        value: 200,
        dailyDouble: false,
      }),
      expect.objectContaining({
        round: "jeopardy",
        value: 400,
        dailyDouble: true,
      }),
      expect.objectContaining({
        round: "double-jeopardy",
        value: 400,
      }),
      expect.objectContaining({
        round: "final-jeopardy",
        value: 0,
      }),
    ]);
  });

  it("returns actionable validation errors for invalid CSV rows", () => {
    const csv = [
      "round,cat,q,a",
      "unknown,Potpourri,Question,Answer",
      "jeopardy,,Missing category,Answer",
      "double,Science,Missing answer,",
    ].join("\n");

    const result = normalizeCustomCsvGame(csv);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          code: "invalid-round",
          row: 2,
          field: "round",
        }),
        expect.objectContaining({
          severity: "error",
          code: "missing-field",
          row: 3,
          field: "category",
        }),
        expect.objectContaining({
          severity: "error",
          code: "missing-field",
          row: 4,
          field: "answer",
        }),
      ]),
    );
  });

  it("rejects empty custom CSV input", () => {
    expect(normalizeCustomCsvGame("  ")).toEqual({
      ok: false,
      issues: [
        {
          severity: "error",
          code: "empty-input",
          message: "Custom game CSV is empty.",
        },
      ],
    });
  });
});
