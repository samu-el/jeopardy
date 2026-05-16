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
];

function make() {
  return createGame({
    roomId: "reopen-test",
    players,
    clues,
    now: 0,
    settings: {
      hostId: "p1",
      buzzUnlockDelayMs: 100,
      answerTimeoutMs: 10_000,
    },
  });
}

function run(state: GameState, command: GameCommand, now: number) {
  return dispatchGameCommand(state, command, { now });
}

describe("Buzzer reopen on wrong", () => {
  function setup(): GameState {
    let s = run(make(), { type: "start-game", actorId: "p1" }, 10).state;
    s = run(s, { type: "pick-clue", actorId: "p1", clueId: "j-1" }, 20).state;
    return s;
  }

  it("clears the wrong player's buzz and lets others ring in", () => {
    let s = setup();
    // p1 buzzes, p1 submits answer, host reveals + judges wrong
    s = run(s, { type: "buzz", actorId: "p1" }, 200).state;
    s = run(s, { type: "submit-answer", actorId: "p1", answer: "Venus" }, 220).state;
    s = run(s, { type: "reveal-answer", actorId: "p1" }, 240).state;
    s = run(
      s,
      { type: "judge-answer", actorId: "p1", targetPlayerId: "p1", correct: false },
      260,
    ).state;

    expect(s.activeClue?.buzzes.p1).toBeUndefined();
    expect(s.activeClue?.canAdvance).toBe(false);
    expect(s.activeClue?.answerRevealed).toBe(false);
    expect(s.activeClue?.judges.p1).toBe(false);

    // p2 can now buzz
    const buzz = run(s, { type: "buzz", actorId: "p2" }, 280);
    expect(buzz.events[0].type).toBe("buzz-accepted");
  });

  it("locks the wrong player from buzzing again", () => {
    let s = setup();
    s = run(s, { type: "buzz", actorId: "p1" }, 200).state;
    s = run(s, { type: "submit-answer", actorId: "p1", answer: "Venus" }, 220).state;
    s = run(s, { type: "reveal-answer", actorId: "p1" }, 240).state;
    s = run(
      s,
      { type: "judge-answer", actorId: "p1", targetPlayerId: "p1", correct: false },
      260,
    ).state;

    const rebuzz = run(s, { type: "buzz", actorId: "p1" }, 280);
    expect(rebuzz.events[0]).toMatchObject({
      type: "command-rejected",
      reason: "already-buzzed",
    });
  });

  it("ends the clue when the wrong player was the last remaining buzzer", () => {
    // Only one player can answer; if they're wrong, no one else can take it.
    const solo: GamePlayer[] = [
      { id: "you", displayName: "You", kind: "human", connected: true, spectator: false },
    ];
    let s = createGame({
      roomId: "solo-reopen",
      players: solo,
      clues,
      now: 0,
      settings: { hostId: "you", buzzUnlockDelayMs: 100, answerTimeoutMs: 10_000 },
    });
    s = run(s, { type: "start-game", actorId: "you" }, 10).state;
    s = run(s, { type: "pick-clue", actorId: "you", clueId: "j-1" }, 20).state;
    s = run(s, { type: "buzz", actorId: "you" }, 200).state;
    s = run(s, { type: "submit-answer", actorId: "you", answer: "Venus" }, 220).state;
    s = run(s, { type: "reveal-answer", actorId: "you" }, 240).state;
    s = run(
      s,
      { type: "judge-answer", actorId: "you", targetPlayerId: "you", correct: false },
      260,
    ).state;

    // No one else to buzz — clue should be able to advance
    expect(s.activeClue?.canAdvance).toBe(true);
  });

  it("closes the clue if the answer window has expired even with players remaining", () => {
    let s = setup();
    s = run(s, { type: "buzz", actorId: "p1" }, 200).state;
    s = run(s, { type: "submit-answer", actorId: "p1", answer: "Venus" }, 220).state;
    s = run(s, { type: "reveal-answer", actorId: "p1" }, 240).state;
    // Judge well after the answer window expired (window = 10s after readout @ 100ms)
    s = run(
      s,
      { type: "judge-answer", actorId: "p1", targetPlayerId: "p1", correct: false },
      50_000,
    ).state;

    expect(s.activeClue?.canAdvance).toBe(true);
  });

  it("preserves the existing Final Jeopardy flow (no reopen, queue keeps going)", () => {
    // Two regular clues + a final
    const finalClues: GameClue[] = [
      { id: "j-1", round: "jeopardy", category: "Warmup", value: 400, clue: "1+1.", correctResponse: "2" },
      { id: "j-2", round: "jeopardy", category: "Warmup", value: 200, clue: "2+2.", correctResponse: "4" },
      {
        id: "final",
        round: "final-jeopardy",
        category: "Tech",
        value: 0,
        clue: "First computer program author.",
        correctResponse: "Ada Lovelace",
      },
    ];
    let s = createGame({
      roomId: "fj",
      players,
      clues: finalClues,
      now: 0,
      settings: {
        hostId: "p1",
        buzzUnlockDelayMs: 100,
        answerTimeoutMs: 10_000,
        finalTimeoutMs: 30_000,
      },
    });

    // Play through regular round to give both scores
    s = run(s, { type: "start-game", actorId: "p1" }, 10).state;
    s = run(s, { type: "pick-clue", actorId: "p1", clueId: "j-1" }, 20).state;
    s = run(s, { type: "buzz", actorId: "p1" }, 200).state;
    s = run(s, { type: "submit-answer", actorId: "p1", answer: "2" }, 220).state;
    s = run(s, { type: "reveal-answer", actorId: "p1" }, 240).state;
    s = run(
      s,
      { type: "judge-answer", actorId: "p1", targetPlayerId: "p1", correct: true },
      260,
    ).state;
    s = run(s, { type: "skip", actorId: "p1" }, 280).state;
    s = run(s, { type: "pick-clue", actorId: "p1", clueId: "j-2" }, 300).state;
    s = run(s, { type: "buzz", actorId: "p2" }, 480).state;
    s = run(s, { type: "submit-answer", actorId: "p2", answer: "4" }, 500).state;
    s = run(s, { type: "reveal-answer", actorId: "p1" }, 520).state;
    s = run(
      s,
      { type: "judge-answer", actorId: "p1", targetPlayerId: "p2", correct: true },
      540,
    ).state;
    s = run(s, { type: "skip", actorId: "p1" }, 560).state;

    // Now in final-jeopardy
    expect(s.round).toBe("final-jeopardy");
    s = run(s, { type: "submit-wager", actorId: "p1", amount: 100 }, 700).state;
    s = run(s, { type: "submit-wager", actorId: "p2", amount: 50 }, 720).state;
    s = run(s, { type: "submit-answer", actorId: "p1", answer: "wrong" }, 900).state;
    s = run(s, { type: "submit-answer", actorId: "p2", answer: "Ada Lovelace" }, 920).state;
    s = run(s, { type: "reveal-answer", actorId: "p1" }, 940).state;
    s = run(
      s,
      { type: "judge-answer", actorId: "p1", targetPlayerId: "p1", correct: false },
      960,
    ).state;

    // In final jeopardy, p1's buzz is NOT cleared (no reopen path); answerRevealed stays true
    expect(s.activeClue?.answerRevealed).toBe(true);
    expect(s.activeClue?.buzzes.p1).toBeDefined();
  });
});
