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
import { getFinalRecord, getFinalReveal } from "@/lib/game/final-reveal";

const players: GamePlayer[] = [
  { id: "p1", displayName: "Ada", kind: "human", connected: true, spectator: false },
  { id: "p2", displayName: "Grace", kind: "human", connected: true, spectator: false },
  { id: "tv", displayName: "Display", kind: "human", connected: true, spectator: true },
];

const clues: GameClue[] = [
  { id: "j-1", round: "jeopardy", category: "W", value: 400, clue: "1 + 1.", correctResponse: "2" },
  { id: "j-2", round: "jeopardy", category: "W", value: 200, clue: "2 + 2.", correctResponse: "4" },
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

/** Ada on $400 and Grace on $200, both in the black, so both play Final. */
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
  s = run(s, { type: "skip", actorId: "p1" }, 280);
  s = run(s, { type: "pick-clue", actorId: "p1", clueId: "j-2" }, 300);
  s = run(s, { type: "buzz", actorId: "p2" }, 480);
  s = run(s, { type: "submit-answer", actorId: "p2", answer: "4" }, 500);
  s = run(s, { type: "reveal-answer", actorId: "p1" }, 520);
  s = run(s, { type: "judge-answer", actorId: "p1", targetPlayerId: "p2", correct: true }, 540);
  return run(s, { type: "skip", actorId: "p1" }, 560);
}

describe("getFinalReveal", () => {
  it("is null outside Final Jeopardy", () => {
    const s = createGame({ roomId: "x", players, clues, now: 0 });
    expect(getFinalReveal(getPublicGameState(s, 0))).toBeNull();
  });

  it("walks wagering, answering, revealing and done without leaking early", () => {
    let s = toFinal();
    expect(s.round).toBe("final-jeopardy");
    let reveal = getFinalReveal(getPublicGameState(s, 580))!;
    expect(reveal.phase).toBe("wagering");
    expect(reveal.category).toBe("Computing");
    expect(reveal.waitingFor.sort()).toEqual(["Ada", "Grace"]);
    expect(reveal.rows).toEqual([]);

    s = run(s, { type: "submit-wager", actorId: "p1", amount: 300 }, 600);
    s = run(s, { type: "submit-wager", actorId: "p2", amount: 0 }, 610);
    reveal = getFinalReveal(getPublicGameState(s, 620))!;
    expect(reveal.phase).toBe("answering");
    expect(reveal.clue).toContain("computer program");
    expect(reveal.rows).toEqual([]);

    s = run(s, { type: "submit-answer", actorId: "p1", answer: "Ada Lovelace" }, 800);
    s = run(s, { type: "submit-answer", actorId: "p2", answer: "Python" }, 810);
    s = run(s, { type: "reveal-answer", actorId: "p1" }, 820);
    reveal = getFinalReveal(getPublicGameState(s, 830))!;
    expect(reveal.phase).toBe("revealing");
    // Lowest score first, and the television never appears.
    expect(reveal.rows.map((row) => row.displayName)).toEqual(["Grace", "Ada"]);
    expect(reveal.rows[0]).toMatchObject({ answer: "Python", wager: 0, current: true });
    expect(reveal.rows[1].verdict).toBeUndefined();

    s = run(s, { type: "judge-answer", actorId: "p1", targetPlayerId: "p2", correct: false }, 840);
    s = run(s, { type: "judge-answer", actorId: "p1", targetPlayerId: "p1", correct: true }, 850);
    reveal = getFinalReveal(getPublicGameState(s, 860))!;
    expect(reveal.phase).toBe("done");
    expect(reveal.rows[1]).toMatchObject({
      displayName: "Ada",
      verdict: true,
      wager: 300,
      scoreBefore: 400,
      scoreAfter: 700,
    });
    expect(reveal.rows[0]).toMatchObject({ scoreBefore: 200, scoreAfter: 200, verdict: false });

    // And after the game, the same story from the room's record.
    s = run(s, { type: "skip", actorId: "p1" }, 870);
    const over = getPublicGameState(s, 880);
    expect(over.round).toBe("complete");
    expect(getFinalReveal(over)).toBeNull();
    const record = getFinalRecord(over)!;
    expect(record.correctResponse).toBe("Ada Lovelace");
    expect(
      record.rows.map((r) => [r.displayName, r.answer, r.verdict, r.scoreBefore, r.scoreAfter]),
    ).toEqual([
      ["Grace", "Python", false, 200, 200],
      ["Ada", "Ada Lovelace", true, 400, 700],
    ]);
  });

  it("degrades to an empty reveal when the room sends no answers or wagers", () => {
    let s = toFinal();
    s = run(s, { type: "submit-wager", actorId: "p1", amount: 300 }, 600);
    s = run(s, { type: "submit-wager", actorId: "p2", amount: 0 }, 610);
    s = run(s, { type: "reveal-answer", actorId: "p1" }, 620);
    const view = getPublicGameState(s, 630);
    view.currentClue = { ...view.currentClue!, answers: {}, wagers: {} };
    const reveal = getFinalReveal(view)!;
    expect(reveal.correctResponse).toBe("Ada Lovelace");
    expect(reveal.rows).toEqual([]);
    expect(getFinalRecord(view)).toBeNull();
  });
});
