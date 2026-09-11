import { describe, expect, it } from "vitest";
import {
  createGame,
  dispatchGameCommand,
  type GameClue,
  type GameCommand,
  type GamePlayer,
  type GameState,
} from "@/lib/game";

const players: GamePlayer[] = [
  { id: "p1", displayName: "Ada", kind: "human", connected: true, spectator: false },
  { id: "p2", displayName: "Grace", kind: "human", connected: true, spectator: false },
];

const clues: GameClue[] = [
  {
    id: "j-1",
    round: "jeopardy",
    category: "Planets",
    value: 200,
    clue: "Red planet.",
    correctResponse: "Mars",
  },
  {
    id: "j-dd",
    round: "jeopardy",
    category: "Planets",
    value: 400,
    clue: "Ringed planet.",
    correctResponse: "Saturn",
    dailyDouble: true,
  },
  {
    id: "f-1",
    round: "final-jeopardy",
    category: "Computing",
    value: 0,
    clue: "First published computer program.",
    correctResponse: "Ada Lovelace",
  },
];

function make() {
  return createGame({
    roomId: "reveal-test",
    players,
    clues,
    now: 0,
    settings: { hostId: "p1", buzzUnlockDelayMs: 100, answerTimeoutMs: 10_000 },
  });
}

function run(state: GameState, command: GameCommand, now: number) {
  return dispatchGameCommand(state, command, { now });
}

/**
 * The answer window is a deadline, not a duration: once the player who rang
 * in has answered, nobody is waiting for anything, and the seconds left on
 * the clock were dead air for the whole room.
 */
describe("Reveal on the last answer", () => {
  it("reveals the moment the player who rang in submits", () => {
    let s = run(make(), { type: "start-game", actorId: "p1" }, 10).state;
    s = run(s, { type: "pick-clue", actorId: "p1", clueId: "j-1" }, 20).state;
    s = run(s, { type: "buzz", actorId: "p1" }, 200).state;

    const result = run(s, { type: "submit-answer", actorId: "p1", answer: "Mars" }, 220);

    expect(result.events.map((event) => event.type)).toEqual([
      "answer-submitted",
      "answer-revealed",
    ]);
    expect(result.state.activeClue).toMatchObject({
      answerRevealed: true,
      currentJudgePlayerId: "p1",
      canAdvance: false,
    });
    // The window still had most of its ten seconds to run.
    expect(result.state.activeClue!.answerWindowEndsAt!).toBeGreaterThan(220);
  });

  it("reveals when the Daily Double picker answers", () => {
    let s = run(make(), { type: "start-game", actorId: "p1" }, 10).state;
    s = run(s, { type: "pick-clue", actorId: "p1", clueId: "j-dd" }, 20).state;
    s = run(s, { type: "submit-wager", actorId: "p1", amount: 300 }, 30).state;

    const result = run(s, { type: "submit-answer", actorId: "p1", answer: "Saturn" }, 300);

    expect(result.state.activeClue?.answerRevealed).toBe(true);
    expect(result.state.activeClue?.currentJudgePlayerId).toBe("p1");
  });

  it("in Final Jeopardy waits for the whole table, then reveals on the last one", () => {
    let s = run(make(), { type: "start-game", actorId: "p1" }, 10).state;
    // Play out the round so the game moves on to Final.
    s = run(s, { type: "pick-clue", actorId: "p1", clueId: "j-1" }, 20).state;
    s = run(s, { type: "buzz", actorId: "p1" }, 200).state;
    s = run(s, { type: "submit-answer", actorId: "p1", answer: "Mars" }, 220).state;
    s = run(s, { type: "judge-answer", actorId: "p1", targetPlayerId: "p1", correct: true }, 240).state;
    s = run(s, { type: "skip", actorId: "p1" }, 260).state;
    s = run(s, { type: "pick-clue", actorId: "p1", clueId: "j-dd" }, 300).state;
    s = run(s, { type: "submit-wager", actorId: "p1", amount: 5 }, 310).state;
    s = run(s, { type: "submit-answer", actorId: "p1", answer: "Saturn" }, 500).state;
    s = run(s, { type: "judge-answer", actorId: "p1", targetPlayerId: "p1", correct: true }, 520).state;
    s = run(s, { type: "skip", actorId: "p1" }, 540).state;
    expect(s.round).toBe("final-jeopardy");

    s = run(s, { type: "pick-clue", actorId: "p1", clueId: "f-1" }, 600).state;
    s = run(s, { type: "submit-wager", actorId: "p1", amount: 0 }, 610).state;
    s = run(s, { type: "submit-wager", actorId: "p2", amount: 0 }, 620).state;

    const first = run(s, { type: "submit-answer", actorId: "p1", answer: "Ada Lovelace" }, 800);
    expect(first.state.activeClue?.answerRevealed).toBe(false);
    expect(first.events.map((event) => event.type)).toEqual(["answer-submitted"]);

    const last = run(first.state, { type: "submit-answer", actorId: "p2", answer: "Grace Hopper" }, 820);
    expect(last.state.activeClue?.answerRevealed).toBe(true);
    expect(last.events.map((event) => event.type)).toEqual([
      "answer-submitted",
      "answer-revealed",
    ]);
  });
});
