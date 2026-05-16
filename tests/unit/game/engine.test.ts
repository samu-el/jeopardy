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
  {
    id: "p1",
    displayName: "Ada",
    kind: "human",
    connected: true,
    spectator: false,
  },
  {
    id: "p2",
    displayName: "Grace",
    kind: "human",
    connected: true,
    spectator: false,
  },
];

const standardClues: GameClue[] = [
  {
    id: "j-200",
    round: "jeopardy",
    category: "Planets",
    value: 200,
    clue: "The red planet.",
    correctResponse: "Mars",
  },
  {
    id: "j-dd",
    round: "jeopardy",
    category: "Math",
    value: 400,
    clue: "Two plus two.",
    correctResponse: "Four",
    dailyDouble: true,
  },
  {
    id: "f-1",
    round: "final-jeopardy",
    category: "Computing",
    value: 0,
    clue: "This person is credited with the first published computer program.",
    correctResponse: "Ada Lovelace",
  },
];

function createSampleGame(clues: GameClue[] = standardClues) {
  return createGame({
    roomId: "room-1",
    players,
    clues,
    now: 0,
    settings: {
      hostId: "p1",
      buzzUnlockDelayMs: 100,
      answerTimeoutMs: 1_000,
      finalTimeoutMs: 2_000,
    },
  });
}

function run(state: GameState, command: GameCommand, now: number) {
  return dispatchGameCommand(state, command, { now });
}

describe("game engine", () => {
  it("starts the first playable round and exposes only render-safe board state", () => {
    const result = run(createSampleGame(), { type: "start-game", actorId: "p1" }, 10);
    const publicState = getPublicGameState(result.state, 10);

    expect(result.events.map((event) => event.type)).toEqual([
      "game-started",
      "round-advanced",
    ]);
    expect(publicState.round).toBe("jeopardy");
    expect(publicState.pickerId).toBe("p1");
    expect(publicState.board).toHaveLength(2);
    expect(publicState.board[0]).toEqual({
      id: "j-200",
      category: "Planets",
      value: 200,
      revealed: false,
      clue: undefined,
    });
    expect(JSON.stringify(publicState)).not.toContain("Mars");
  });

  it("plays a regular clue through buzz, answer, reveal, judge, and undo", () => {
    let state = run(createSampleGame(), { type: "start-game", actorId: "p1" }, 10)
      .state;
    state = run(state, { type: "pick-clue", actorId: "p1", clueId: "j-200" }, 20)
      .state;

    expect(getPublicGameState(state, 50).currentClue).toMatchObject({
      clueId: "j-200",
      clue: "The red planet.",
      correctResponse: undefined,
      canBuzz: false,
    });

    const earlyBuzz = run(state, { type: "buzz", actorId: "p2" }, 50);
    expect(earlyBuzz.events[0]).toMatchObject({
      type: "command-rejected",
      reason: "buzz-not-open",
    });

    state = run(state, { type: "buzz", actorId: "p2" }, 120).state;
    state = run(
      state,
      { type: "submit-answer", actorId: "p2", answer: "Mars" },
      130,
    ).state;

    expect(getPublicGameState(state, 130).currentClue?.answers).toEqual({});

    state = run(state, { type: "reveal-answer", actorId: "p1" }, 140).state;
    expect(getPublicGameState(state, 140).currentClue).toMatchObject({
      correctResponse: "Mars",
      answers: {
        p2: "Mars",
      },
    });

    const judged = run(
      state,
      {
        type: "judge-answer",
        actorId: "p1",
        targetPlayerId: "p2",
        correct: true,
      },
      150,
    );
    expect(judged.events).toContainEqual({
      type: "score-changed",
      playerId: "p2",
      score: 200,
      delta: 200,
    });
    expect(getPublicGameState(judged.state, 150).players[0]).toMatchObject({
      id: "p2",
      score: 200,
    });

    const undone = run(judged.state, { type: "undo", actorId: "p1" }, 160);
    expect(getPublicGameState(undone.state, 160).currentClue).toMatchObject({
      correctResponse: undefined,
      answers: {},
    });
    expect(getPublicGameState(undone.state, 160).players).toContainEqual(
      expect.objectContaining({ id: "p2", score: 0 }),
    );
  });

  it("keeps Daily Double clue text and wager private until the correct reveal points", () => {
    let state = run(createSampleGame(), { type: "start-game", actorId: "p1" }, 10)
      .state;
    state = run(state, { type: "pick-clue", actorId: "p1", clueId: "j-dd" }, 20)
      .state;

    let publicState = getPublicGameState(state, 20);
    expect(publicState.currentClue).toMatchObject({
      clueId: "j-dd",
      dailyDouble: true,
      clue: undefined,
      waitingForWager: ["p1"],
      wagers: {},
    });
    expect(JSON.stringify(publicState)).not.toContain("Two plus two");
    expect(JSON.stringify(publicState)).not.toContain("Four");

    state = run(state, { type: "submit-wager", actorId: "p1", amount: 9_999 }, 30)
      .state;
    publicState = getPublicGameState(state, 30);
    expect(publicState.currentClue).toMatchObject({
      clue: "Two plus two.",
      wagers: {},
    });

    state = run(
      state,
      { type: "submit-answer", actorId: "p1", answer: "Four" },
      140,
    ).state;
    state = run(state, { type: "reveal-answer", actorId: "p1" }, 150).state;

    expect(getPublicGameState(state, 150).currentClue).toMatchObject({
      correctResponse: "Four",
      wagers: {
        p1: 1_000,
      },
    });
  });

  it("advances to Final Jeopardy with private wagers before answer reveal", () => {
    let state = createSampleGame([
      {
        id: "j-200",
        round: "jeopardy",
        category: "Planets",
        value: 200,
        clue: "The red planet.",
        correctResponse: "Mars",
      },
      standardClues[2],
    ]);
    state = run(state, { type: "start-game", actorId: "p1" }, 10).state;
    state = run(state, { type: "pick-clue", actorId: "p1", clueId: "j-200" }, 20)
      .state;
    state = run(state, { type: "buzz", actorId: "p2" }, 120).state;
    state = run(
      state,
      { type: "submit-answer", actorId: "p2", answer: "Mars" },
      130,
    ).state;
    state = run(state, { type: "reveal-answer", actorId: "p1" }, 140).state;
    state = run(
      state,
      {
        type: "judge-answer",
        actorId: "p1",
        targetPlayerId: "p2",
        correct: true,
      },
      150,
    ).state;

    const advanced = run(state, { type: "skip", actorId: "p1" }, 160);
    expect(advanced.events).toContainEqual({
      type: "round-advanced",
      round: "final-jeopardy",
    });
    state = advanced.state;
    expect(getPublicGameState(state, 160).currentClue).toMatchObject({
      clueId: "f-1",
      clue: undefined,
      waitingForWager: ["p1", "p2"],
      wagers: {},
    });

    state = run(state, { type: "submit-wager", actorId: "p1", amount: 0 }, 170).state;
    state = run(state, { type: "submit-wager", actorId: "p2", amount: 200 }, 180).state;

    expect(getPublicGameState(state, 180).currentClue).toMatchObject({
      clue: "This person is credited with the first published computer program.",
      wagers: {},
    });
  });

  it("rejects host-only commands from non-host players", () => {
    let state = createSampleGame();
    const rejectedStart = run(state, { type: "start-game", actorId: "p2" }, 10);
    expect(rejectedStart.events[0]).toMatchObject({
      type: "command-rejected",
      reason: "not-authorized",
    });

    state = run(state, { type: "start-game", actorId: "p1" }, 20).state;
    const rejectedSettings = run(
      state,
      {
        type: "update-settings",
        actorId: "p2",
        settings: { aiBotsEnabled: true },
      },
      30,
    );
    expect(rejectedSettings.events[0]).toMatchObject({
      type: "command-rejected",
      reason: "not-authorized",
    });
  });

  it("separates the buzz window from the per-buzz answer window", () => {
    let state = createSampleGame();
    state = run(state, { type: "start-game", actorId: "p1" }, 10).state;
    state = run(state, { type: "pick-clue", actorId: "p1", clueId: "j-200" }, 20).state;

    const afterPick = getPublicGameState(state, 50).currentClue!;
    // Before readout ends: no answer deadline yet, buzz window already set.
    expect(afterPick.readoutEndsAt).toBe(120);
    expect(afterPick.buzzWindowEndsAt).toBeGreaterThan(afterPick.readoutEndsAt!);
    expect(afterPick.answerWindowEndsAt).toBeUndefined();

    state = run(state, { type: "buzz", actorId: "p2" }, 150).state;
    const afterBuzz = getPublicGameState(state, 150).currentClue!;
    // Buzzing closes the ring-in window and starts a fresh answer deadline.
    expect(afterBuzz.buzzWindowEndsAt).toBe(150);
    expect(afterBuzz.answerWindowEndsAt).toBe(1_150); // 150 + answerTimeoutMs (1_000)
    expect(afterBuzz.submitted).toEqual({});

    state = run(
      state,
      { type: "submit-answer", actorId: "p2", answer: "Mars" },
      200,
    ).state;
    const afterSubmit = getPublicGameState(state, 200).currentClue!;
    expect(afterSubmit.submitted).toEqual({ p2: true });
  });

  it("readout-complete shortens the readout when TTS finishes early", () => {
    // Game with a long readout estimate so the TTS callback has room to fire first.
    const longGame = createGame({
      roomId: "tts-room",
      players,
      clues: standardClues,
      now: 0,
      settings: {
        hostId: "p1",
        buzzUnlockDelayMs: 10_000, // upper-bound fallback for the readout
        buzzWindowMs: 6_000,
        answerTimeoutMs: 8_000,
      },
    });
    let state = run(longGame, { type: "start-game", actorId: "p1" }, 10).state;
    state = run(state, { type: "pick-clue", actorId: "p1", clueId: "j-200" }, 20).state;

    expect(state.activeClue!.readoutEndsAt).toBe(10_020); // 20 + 10_000

    // Host's TTS finishes early at t=1500.
    state = run(
      state,
      { type: "readout-complete", actorId: "p1", clueId: "j-200" },
      1_500,
    ).state;
    expect(state.activeClue!.readoutEndsAt).toBe(1_500);
    expect(state.activeClue!.buzzWindowEndsAt).toBe(1_500 + 6_000);

    // p2 can now buzz immediately.
    const buzzResult = run(state, { type: "buzz", actorId: "p2" }, 1_600);
    expect(buzzResult.events[0].type).toBe("buzz-accepted");
  });

  it("readout-complete is a no-op once someone has buzzed", () => {
    let state = createSampleGame();
    state = run(state, { type: "start-game", actorId: "p1" }, 10).state;
    state = run(state, { type: "pick-clue", actorId: "p1", clueId: "j-200" }, 20).state;
    state = run(state, { type: "buzz", actorId: "p2" }, 200).state;
    const before = state.activeClue!.buzzWindowEndsAt;

    state = run(
      state,
      { type: "readout-complete", actorId: "p1", clueId: "j-200" },
      210,
    ).state;
    expect(state.activeClue!.buzzWindowEndsAt).toBe(before); // unchanged
  });
});
