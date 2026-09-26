import { describe, expect, it } from "vitest";
import {
  buzzOrder,
  deriveClueTurn,
  lastRuling,
  seatOrder,
  validateWager,
  wagerLimitsFor,
} from "@/lib/game/clue-turn";
import { announce } from "@/lib/game/announcer";
import type { PublicActiveClueState, PublicGameState } from "@/lib/game";

function clue(overrides: Partial<PublicActiveClueState> = {}): PublicActiveClueState {
  return {
    clueId: "c1",
    round: "jeopardy",
    dailyDouble: false,
    category: "MATH",
    value: 200,
    clue: "Two plus two.",
    readoutEndsAt: 1_000,
    buzzWindowEndsAt: 7_000,
    waitingForWager: [],
    buzzes: {},
    answers: {},
    submitted: {},
    wagers: {},
    judges: {},
    canAdvance: false,
    lockouts: {},
    canBuzz: false,
    ...overrides,
  };
}

function state(current?: PublicActiveClueState, overrides: Partial<PublicGameState> = {}): PublicGameState {
  return {
    roomId: "R",
    round: "jeopardy",
    serverTime: 0,
    pickerId: "me",
    players: [
      { id: "me", displayName: "Me", kind: "human", connected: true, spectator: false, score: 0 },
      { id: "sam", displayName: "Sam", kind: "human", connected: true, spectator: false, score: 400 },
    ],
    board: [],
    currentClue: current,
    settings: {
      allowMultipleCorrect: false,
      hostId: "me",
      aiJudgeEnabled: true,
      aiBotsEnabled: false,
      aiAvatarHostEnabled: false,
      autoAdvanceMs: 3_500,
      earlyBuzzLockoutMs: 250,
    },
    stats: {
      questionsStarted: 0,
      answeredByPlayer: {},
      correctByPlayer: {},
      incorrectByPlayer: {},
      firstBuzzByPlayer: {},
      reactionTimesByPlayer: {},
      dailyDoublesByPlayer: {},
    },
    ...overrides,
  };
}

describe("deriveClueTurn", () => {
  it("keeps the lamps dark while the clue is read, and lights them when buzzing opens", () => {
    const reading = deriveClueTurn(state(clue()), "me", 500);
    expect(reading.phase).toBe("reading");
    expect(reading.lightsRemaining).toBe(0);
    expect(reading.canIBuzz).toBe(false);

    const open = deriveClueTurn(state(clue()), "me", 1_000);
    expect(open.phase).toBe("ring-in");
    expect(open.lightsRemaining).toBe(1);
    expect(open.canIBuzz).toBe(true);
    expect(open.clockValueText).toBe("6 seconds left to ring in");
  });

  it("sizes a rebound window from what was observed, not from the first readout", () => {
    const reopened = clue({ readoutEndsAt: 1_000, buzzWindowEndsAt: 20_000, judges: { sam: false } });
    const view = deriveClueTurn(state(reopened), "me", 14_000, { buzzMs: 6_000 });
    expect(view.lightsRemaining).toBe(1);
  });

  it("gives only the Daily Double player the answer field, and names them for everyone else", () => {
    const dd = clue({
      dailyDouble: true,
      dailyDoublePlayerId: "sam",
      buzzes: { sam: 1_000 },
      answerWindowEndsAt: 11_000,
    });
    const mine = deriveClueTurn(state(dd), "me", 2_000);
    expect(mine.mayAnswer).toBe(false);
    expect(mine.clockLabel).toBe("Daily Double · Sam");
    expect(mine.canIBuzz).toBe(false);

    const theirs = deriveClueTurn(state(dd), "sam", 2_000);
    expect(theirs.mayAnswer).toBe(true);
    expect(theirs.clockLabel).toBe("Daily Double · your answer");
  });

  it("does not say anyone rang in during Final Jeopardy", () => {
    const final = clue({
      round: "final-jeopardy",
      buzzes: { me: 1_000, sam: 1_000 },
      answerWindowEndsAt: 31_000,
    });
    const view = deriveClueTurn(state(final, { round: "final-jeopardy" }), "sam", 2_000);
    expect(view.clockLabel).toBe("Final answer");
    expect(view.mayAnswer).toBe(true);
  });

  it("puts a player with no money in Final Jeopardy in the audience", () => {
    const final = clue({ round: "final-jeopardy", clue: undefined, waitingForWager: ["me", "sam"] });
    const view = deriveClueTurn(state(final, { round: "final-jeopardy" }), "me", 2_000);
    expect(view.spectatingFinal).toBe(true);
    expect(view.wagerLimits).toEqual({ min: 0, max: 0 });
  });

  it("reports time's up and the auto-advance countdown", () => {
    const done = clue({
      correctResponse: "What is four?",
      timedOut: true,
      canAdvance: true,
      closesAt: 10_000,
    });
    const view = deriveClueTurn(state(done), "me", 7_600);
    expect(view.phase).toBe("timed-out");
    expect(view.clockLabel).toBe("Time's up");
    expect(view.autoAdvanceSeconds).toBe(3);
  });
});

describe("wagers", () => {
  it("reports an out-of-range wager instead of clamping it", () => {
    const limits = wagerLimitsFor(clue(), 200);
    expect(limits).toEqual({ min: 5, max: 1_000 });
    expect(validateWager("99999", limits)).toEqual({ ok: false, message: "Maximum wager is $1000." });
    expect(validateWager("2", limits)).toEqual({ ok: false, message: "Minimum wager is $5." });
    expect(validateWager("", limits).ok).toBe(false);
    expect(validateWager("500", limits)).toEqual({ ok: true, amount: 500 });
  });
});

describe("seats and rulings", () => {
  it("keeps lecterns in join order whatever the scores", () => {
    const players = [
      { id: "b", joinedAt: 2, score: 1_000 },
      { id: "a", joinedAt: 1, score: -200 },
      { id: "c", score: 0 },
    ];
    expect(seatOrder(players).map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(seatOrder([{ id: "y" }, { id: "x" }], ["y", "x"]).map((p) => p.id)).toEqual(["y", "x"]);
  });

  it("lists buzz order with earlier wrong answers first", () => {
    expect(buzzOrder(clue({ judges: { sam: false }, buzzes: { me: 5_000 } }))).toEqual(["sam", "me"]);
  });

  it("finds the most recent ruling", () => {
    expect(lastRuling(clue({ judges: { sam: false, me: true } }))).toEqual({ playerId: "me", correct: true });
    expect(lastRuling(clue())).toBeUndefined();
  });
});

describe("announce", () => {
  it("reads a new clue, a ring-in, the answer and the ruling", () => {
    const empty = state(undefined);
    const opened = state(clue());
    expect(announce({ state: empty, phase: "none" }, { state: opened, phase: "reading" }, "me")).toEqual([
      "MATH for $200: Two plus two.",
    ]);
    expect(
      announce({ state: opened, phase: "reading" }, { state: opened, phase: "ring-in" }, "me"),
    ).toEqual(["Buzzers open."]);

    const rang = state(clue({ buzzes: { sam: 2_000 } }));
    expect(announce({ state: opened, phase: "ring-in" }, { state: rang, phase: "answering" }, "me")).toEqual([
      "Sam rang in.",
    ]);

    const revealed = state(clue({ buzzes: { sam: 2_000 }, correctResponse: "Four" }));
    const judged = state(clue({ buzzes: { sam: 2_000 }, correctResponse: "Four", judges: { sam: true } }), {
      players: [
        { id: "me", displayName: "Me", kind: "human", connected: true, spectator: false, score: 0 },
        { id: "sam", displayName: "Sam", kind: "human", connected: true, spectator: false, score: 600 },
      ],
    });
    expect(announce({ state: rang, phase: "answering" }, { state: revealed, phase: "judging" }, "me")).toEqual([
      "The answer: Four.",
    ]);
    expect(announce({ state: revealed, phase: "judging" }, { state: judged, phase: "ruled" }, "me")).toEqual([
      "Correct. Sam has $600.",
    ]);
  });

  it("says time's up, round changes and whose pick it is", () => {
    const open = state(clue());
    const timedOut = state(clue({ correctResponse: "Four", timedOut: true }));
    expect(announce({ state: open, phase: "ring-in" }, { state: timedOut, phase: "timed-out" }, "me")).toEqual([
      "Time's up.",
      "The answer: Four.",
    ]);
    const board = state(undefined, { round: "double-jeopardy", pickerId: "sam" });
    expect(announce({ state: timedOut, phase: "timed-out" }, { state: board, phase: "none" }, "me")).toEqual([
      "Double Jeopardy.",
      "Sam picks.",
    ]);
  });
});
