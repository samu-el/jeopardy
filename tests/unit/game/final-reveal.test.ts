import { describe, expect, it } from "vitest";
import {
  createGame,
  dispatchGameCommand,
  getPublicGameState,
  type GameClue,
  type GameCommand,
  type GamePlayer,
  type GameState,
} from "@/lib/game";
import { getFinalReveal } from "@/lib/game/final-reveal";

const players: GamePlayer[] = [
  { id: "p1", displayName: "Ada", kind: "human", connected: true, spectator: false },
  { id: "p2", displayName: "Grace", kind: "human", connected: true, spectator: false },
  { id: "tv", displayName: "Display", kind: "human", connected: true, spectator: true },
];

const clues: GameClue[] = [
  { id: "j-1", round: "jeopardy", category: "W", value: 400, clue: "1 + 1.", correctResponse: "2" },
  {
    id: "final",
    round: "final-jeopardy",
    category: "Computing",
    value: 0,
    clue: "First published computer program author.",
    correctResponse: "Ada Lovelace",
  },
];

function run(state: GameState, command: GameCommand, now: number) {
  return dispatchGameCommand(state, command, { now }).state;
}

function toFinal(): GameState {
  let s = createGame({
    roomId: "fr",
    players,
    clues,
    now: 0,
    settings: { hostId: "p1", buzzUnlockDelayMs: 100, answerTimeoutMs: 1_000, roundIntroMs: 0 },
  });
  s = run(s, { type: "start-game", actorId: "p1" }, 10);
  s = run(s, { type: "pick-clue", actorId: "p1", clueId: "j-1" }, 20);
  s = run(s, { type: "buzz", actorId: "p1" }, 200);
  s = run(s, { type: "submit-answer", actorId: "p1", answer: "2" }, 220);
  s = run(s, { type: "reveal-answer", actorId: "p1" }, 240);
  s = run(s, { type: "judge-answer", actorId: "p1", targetPlayerId: "p1", correct: true }, 260);
  return run(s, { type: "skip", actorId: "p1" }, 280);
}

describe("getFinalReveal", () => {
  it("is null outside Final Jeopardy", () => {
    const s = createGame({ roomId: "x", players, clues, now: 0 });
    expect(getFinalReveal(getPublicGameState(s, 0))).toBeNull();
  });

  it("walks wagering, answering, revealing and done without leaking early", () => {
    let s = toFinal();
    expect(s.round).toBe("final-jeopardy");
    let reveal = getFinalReveal(getPublicGameState(s, 300))!;
    expect(reveal.phase).toBe("wagering");
    expect(reveal.category).toBe("Computing");
    expect(reveal.waitingFor.sort()).toEqual(["Ada", "Grace"]);
    expect(reveal.rows).toEqual([]);

    s = run(s, { type: "submit-wager", actorId: "p1", amount: 300 }, 400);
    s = run(s, { type: "submit-wager", actorId: "p2", amount: 0 }, 410);
    reveal = getFinalReveal(getPublicGameState(s, 500))!;
    expect(reveal.phase).toBe("answering");
    expect(reveal.clue).toContain("computer program");
    expect(reveal.rows).toEqual([]);

    s = run(s, { type: "submit-answer", actorId: "p1", answer: "Ada Lovelace" }, 600);
    s = run(s, { type: "submit-answer", actorId: "p2", answer: "Python" }, 610);
    s = run(s, { type: "reveal-answer", actorId: "p1" }, 620);
    reveal = getFinalReveal(getPublicGameState(s, 700))!;
    expect(reveal.phase).toBe("revealing");
    // Lowest score first, and the television never appears.
    expect(reveal.rows.map((row) => row.displayName)).toEqual(["Grace", "Ada"]);
    expect(reveal.rows[0]).toMatchObject({ answer: "Python", wager: 0, current: true });
    expect(reveal.rows[1].verdict).toBeUndefined();

    s = run(s, { type: "judge-answer", actorId: "p1", targetPlayerId: "p2", correct: false }, 710);
    s = run(s, { type: "judge-answer", actorId: "p1", targetPlayerId: "p1", correct: true }, 720);
    reveal = getFinalReveal(getPublicGameState(s, 800))!;
    expect(reveal.phase).toBe("done");
    expect(reveal.rows[1]).toMatchObject({
      displayName: "Ada",
      verdict: true,
      wager: 300,
      scoreBefore: 400,
      scoreAfter: 700,
    });
    expect(reveal.rows[0]).toMatchObject({ scoreBefore: 0, scoreAfter: 0, verdict: false });
  });

  it("degrades to an empty reveal when the room sends no answers or wagers", () => {
    let s = toFinal();
    s = run(s, { type: "submit-wager", actorId: "p1", amount: 300 }, 400);
    s = run(s, { type: "submit-wager", actorId: "p2", amount: 0 }, 410);
    s = run(s, { type: "reveal-answer", actorId: "p1" }, 420);
    const view = getPublicGameState(s, 500);
    view.currentClue = { ...view.currentClue!, answers: {}, wagers: {} };
    const reveal = getFinalReveal(view)!;
    expect(reveal.correctResponse).toBe("Ada Lovelace");
    expect(reveal.rows).toEqual([]);
  });
});
