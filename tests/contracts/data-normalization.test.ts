import { describe, expect, it } from "vitest";
import { normalizeCustomCsvGame } from "@/lib/data";
import { createGame, dispatchGameCommand, getPublicGameState } from "@/lib/game";

describe("data normalization contract", () => {
  it("feeds normalized custom CSV clues directly into the game engine", () => {
    const result = normalizeCustomCsvGame(
      [
        "round,cat,q,a,dd",
        "jeopardy,Planets,The red planet,Mars,false",
        "final,Computing,First published computer programmer,Ada Lovelace,false",
      ].join("\n"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const state = createGame({
      roomId: "data-contract",
      players: [
        {
          id: "host",
          displayName: "Host",
          kind: "human",
          connected: true,
          spectator: false,
        },
      ],
      clues: result.game.clues,
      now: 0,
      settings: {
        hostId: "host",
      },
    });

    const started = dispatchGameCommand(
      state,
      { type: "start-game", actorId: "host" },
      { now: 10 },
    ).state;

    expect(getPublicGameState(started, 10).board).toEqual([
      expect.objectContaining({
        category: "Planets",
        value: 200,
        revealed: false,
      }),
    ]);
  });

  it("does not emit duplicate clue ids for repeated CSV categories", () => {
    const result = normalizeCustomCsvGame(
      [
        "round,cat,q,a",
        "jeopardy,Same,One,Answer one",
        "jeopardy,Same,Two,Answer two",
        "jeopardy,Same,Three,Answer three",
      ].join("\n"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const ids = result.game.clues.map((clue) => clue.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
