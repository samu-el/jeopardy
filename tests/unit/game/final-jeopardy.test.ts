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

const players: GamePlayer[] = [
  { id: "p1", displayName: "Ada", kind: "human", connected: true, spectator: false },
  { id: "p2", displayName: "Grace", kind: "human", connected: true, spectator: false },
];

const clues: GameClue[] = [
  {
    id: "j-1",
    round: "jeopardy",
    category: "Warmup",
    value: 400,
    clue: "1 + 1.",
    correctResponse: "2",
  },
  {
    id: "j-2",
    round: "jeopardy",
    category: "Warmup",
    value: 200,
    clue: "2 + 2.",
    correctResponse: "4",
  },
  {
    id: "final",
    round: "final-jeopardy",
    category: "Computing",
    value: 0,
    clue: "First published computer program author.",
    correctResponse: "Ada Lovelace",
  },
];

function make() {
  return createGame({
    roomId: "fj-test",
    players,
    clues,
    now: 0,
    settings: {
      hostId: "p1",
      buzzUnlockDelayMs: 100,
      answerTimeoutMs: 1_000,
      finalTimeoutMs: 30_000,
    },
  });
}

function run(state: GameState, command: GameCommand, now: number) {
  return dispatchGameCommand(state, command, { now });
}

describe("Final Jeopardy flow", () => {
  function playRegularRound(state: GameState): GameState {
    let s = run(state, { type: "start-game", actorId: "p1" }, 10).state;
    // p1 takes the $400 clue
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
    // p2 takes the $200 clue so both have scores
    s = run(s, { type: "pick-clue", actorId: "p1", clueId: "j-2" }, 300).state;
    s = run(s, { type: "buzz", actorId: "p2" }, 480).state;
    s = run(s, { type: "submit-answer", actorId: "p2", answer: "4" }, 500).state;
    s = run(s, { type: "reveal-answer", actorId: "p1" }, 520).state;
    s = run(
      s,
      { type: "judge-answer", actorId: "p1", targetPlayerId: "p2", correct: true },
      540,
    ).state;
    return run(s, { type: "skip", actorId: "p1" }, 560).state;
  }

  it("transitions into final-jeopardy and prompts every active player for a wager", () => {
    const state = playRegularRound(make());
    expect(state.round).toBe("final-jeopardy");
    const active = state.activeClue;
    expect(active).toBeDefined();
    expect(active?.waitingForWager.sort()).toEqual(["p1", "p2"].sort());
    expect(active?.wagerWindowEndsAt).toBeDefined();
  });

  it("uses a 30-second timeout for the final answer window", () => {
    const state = playRegularRound(make());
    expect(state.settings.finalTimeoutMs).toBe(30_000);
  });

  it("hides wagers from the public state until the answer reveal", () => {
    let state = playRegularRound(make());
    state = run(state, { type: "submit-wager", actorId: "p1", amount: 100 }, 500).state;
    state = run(state, { type: "submit-wager", actorId: "p2", amount: 50 }, 510).state;

    const before = getPublicGameState(state, 600);
    expect(before.currentClue?.wagers).toEqual({});

    state = run(state, { type: "submit-answer", actorId: "p1", answer: "Ada Lovelace" }, 700).state;
    state = run(state, { type: "submit-answer", actorId: "p2", answer: "Grace Hopper" }, 720).state;
    state = run(state, { type: "reveal-answer", actorId: "p1" }, 740).state;

    const after = getPublicGameState(state, 800);
    expect(after.currentClue?.wagers).toEqual({ p1: 100, p2: 50 });
  });

  it("applies wagers (not clue.value) when scoring final answers", () => {
    let state = playRegularRound(make());
    state = run(state, { type: "submit-wager", actorId: "p1", amount: 100 }, 500).state;
    state = run(state, { type: "submit-wager", actorId: "p2", amount: 50 }, 510).state;
    state = run(state, { type: "submit-answer", actorId: "p1", answer: "Ada Lovelace" }, 700).state;
    state = run(state, { type: "submit-answer", actorId: "p2", answer: "wrong" }, 720).state;
    state = run(state, { type: "reveal-answer", actorId: "p1" }, 740).state;

    // Final Jeopardy is revealed from the lowest score up, so p2 (200) is
    // judged before p1 (400).
    expect(state.activeClue?.judgeQueue).toEqual(["p2", "p1"]);

    state = run(
      state,
      { type: "judge-answer", actorId: "p1", targetPlayerId: "p2", correct: false },
      760,
    ).state;
    state = run(
      state,
      { type: "judge-answer", actorId: "p1", targetPlayerId: "p1", correct: true },
      780,
    ).state;

    // p1 had 400 from j-1, wins 100 -> 500
    // p2 had 200 from j-2, loses 50 -> 150
    expect(state.scores.p1).toBe(500);
    expect(state.scores.p2).toBe(150);
  });

  it("opens the clue for buzz-less answering — both players can submit", () => {
    let state = playRegularRound(make());
    state = run(state, { type: "submit-wager", actorId: "p1", amount: 100 }, 500).state;
    state = run(state, { type: "submit-wager", actorId: "p2", amount: 50 }, 510).state;
    // Without buzzing, both can submit — engine pre-marks them as buzzed.
    const r1 = run(state, { type: "submit-answer", actorId: "p1", answer: "ok" }, 700);
    const r2 = run(r1.state, { type: "submit-answer", actorId: "p2", answer: "ok" }, 710);
    expect(r1.events[0].type).toBe("answer-submitted");
    expect(r2.events[0].type).toBe("answer-submitted");
  });
});

describe("Single-player buzzing", () => {
  const solo: GamePlayer[] = [
    { id: "you", displayName: "You", kind: "human", connected: true, spectator: false },
  ];
  const soloClues: GameClue[] = [
    {
      id: "j-1",
      round: "jeopardy",
      category: "Solo",
      value: 200,
      clue: "Capital of France.",
      correctResponse: "Paris",
    },
  ];

  it("a lone human can buzz, answer and be judged", () => {
    let state = createGame({
      roomId: "solo",
      players: solo,
      clues: soloClues,
      now: 0,
      settings: {
        hostId: "you",
        buzzUnlockDelayMs: 100,
        answerTimeoutMs: 1_000,
      },
    });
    state = run(state, { type: "start-game", actorId: "you" }, 10).state;
    state = run(state, { type: "pick-clue", actorId: "you", clueId: "j-1" }, 20).state;

    const buzz = run(state, { type: "buzz", actorId: "you" }, 200);
    expect(buzz.events[0].type).toBe("buzz-accepted");
    state = buzz.state;

    state = run(state, { type: "submit-answer", actorId: "you", answer: "Paris" }, 220).state;
    state = run(state, { type: "reveal-answer", actorId: "you" }, 240).state;
    const judged = run(
      state,
      { type: "judge-answer", actorId: "you", targetPlayerId: "you", correct: true },
      260,
    );
    expect(judged.events.some((e) => e.type === "score-changed")).toBe(true);
    expect(judged.state.scores.you).toBe(200);
  });
});
