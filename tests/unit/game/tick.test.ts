import { describe, expect, it } from "vitest";
import {
  createGame,
  dispatchGameCommand,
  tickGame,
  type GameClue,
  type GameCommand,
  type GamePlayer,
  type GameSettings,
  type GameState,
} from "@/lib/game";

const players: GamePlayer[] = [
  { id: "ada", displayName: "Ada", kind: "human", connected: true, spectator: false },
  { id: "gra", displayName: "Grace", kind: "human", connected: true, spectator: false },
];

const clues: GameClue[] = [
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
];

function room(settings: Partial<GameSettings> = {}) {
  return createGame({
    roomId: "tick-room",
    players,
    clues,
    now: 0,
    settings: {
      hostId: "ada",
      buzzUnlockDelayMs: 1_000,
      buzzWindowMs: 5_000,
      answerTimeoutMs: 8_000,
      autoAdvanceMs: 3_000,
      ...settings,
    },
  });
}

function run(state: GameState, command: GameCommand, now: number) {
  return dispatchGameCommand(state, command, { now });
}

function playClue(state: GameState, clueId: string, now = 0) {
  const started = run(state, { type: "start-game", actorId: "ada" }, now);
  return run(started.state, { type: "pick-clue", actorId: "ada", clueId }, now).state;
}

describe("tickGame", () => {
  it("does nothing while every window is still open", () => {
    const state = playClue(room(), "j-200");
    const ticked = tickGame(state, 500);

    expect(ticked.state).toBe(state);
    expect(ticked.events).toEqual([]);
  });

  it("reveals the response when nobody rings in", () => {
    const state = playClue(room(), "j-200");
    const closesAt = state.activeClue!.buzzWindowEndsAt!;

    const ticked = tickGame(state, closesAt);

    expect(ticked.events.map((event) => event.type)).toContain("buzz-window-closed");
    expect(ticked.state.activeClue?.answerRevealed).toBe(true);
    expect(ticked.state.activeClue?.timedOut).toBe(true);
    expect(ticked.state.activeClue?.canAdvance).toBe(true);
    expect(ticked.state.scores.ada).toBe(0);
    expect(ticked.state.scores.gra).toBe(0);
  });

  it("closes out a buzzed player who never answers", () => {
    let state = playClue(room(), "j-200");
    const open = state.activeClue!.readoutEndsAt!;
    state = run(state, { type: "buzz", actorId: "gra" }, open).state;
    const deadline = state.activeClue!.answerWindowEndsAt!;

    const ticked = tickGame(state, deadline);

    expect(ticked.events).toContainEqual({
      type: "answer-timed-out",
      clueId: "j-200",
      playerId: "gra",
    });
    expect(ticked.state.activeClue?.answerRevealed).toBe(true);
    expect(ticked.state.activeClue?.currentJudgePlayerId).toBe("gra");
  });

  it("auto-closes a finished clue and returns the board", () => {
    let state = playClue(room(), "j-200");
    const closesAt = state.activeClue!.buzzWindowEndsAt!;

    // The tick that reveals the response also arms the close timer.
    state = tickGame(state, closesAt).state;
    expect(state.activeClue?.closesAt).toBe(closesAt + 3_000);

    const closed = tickGame(state, closesAt + 3_000);
    expect(closed.state.activeClue).toBeUndefined();
    expect(closed.state.revealedClueIds).toContain("j-200");
    expect(closed.events.map((event) => event.type)).toContain("clue-completed");
  });

  it("leaves the clue up when auto-advance is off", () => {
    let state = playClue(room({ autoAdvanceMs: 0 }), "j-200");
    const closesAt = state.activeClue!.buzzWindowEndsAt!;
    state = tickGame(state, closesAt).state;
    state = tickGame(state, closesAt + 60_000).state;

    expect(state.activeClue?.canAdvance).toBe(true);
    expect(state.activeClue?.closesAt).toBeUndefined();
  });

  it("stakes a default wager when the Daily Double wager window lapses", () => {
    const state = playClue(room(), "j-dd");
    expect(state.activeClue?.waitingForWager).toEqual(["ada"]);
    const deadline = state.activeClue!.wagerWindowEndsAt!;

    const ticked = tickGame(state, deadline);

    expect(ticked.state.activeClue?.waitingForWager).toEqual([]);
    expect(ticked.state.activeClue?.wagers.ada).toBe(400);
    expect(ticked.state.activeClue?.clueRevealed).toBe(true);
    expect(ticked.events.map((event) => event.type)).toContain("clue-revealed");
  });

  it("clears the round intro once its card has run", () => {
    const state = run(room({ roundIntroMs: 2_000 }), { type: "start-game", actorId: "ada" }, 100);
    expect(state.state.roundIntroEndsAt).toBe(2_100);
    expect(
      run(state.state, { type: "pick-clue", actorId: "ada", clueId: "j-200" }, 200)
        .events[0],
    ).toMatchObject({ reason: "cannot-advance" });

    const ticked = tickGame(state.state, 2_100);
    expect(ticked.state.roundIntroEndsAt).toBeUndefined();
    expect(
      run(ticked.state, { type: "pick-clue", actorId: "ada", clueId: "j-200" }, 2_200)
        .state.activeClue,
    ).toBeDefined();
  });
});

describe("early buzz lockout", () => {
  it("locks a jumper out for the penalty window and lets them back in after", () => {
    const state = playClue(room({ earlyBuzzLockoutMs: 250 }), "j-200");
    const open = state.activeClue!.readoutEndsAt!;

    const early = run(state, { type: "buzz", actorId: "gra" }, open - 500);
    expect(early.events[0]).toMatchObject({ type: "buzz-locked-out", actorId: "gra" });
    expect(early.state.activeClue?.buzzes.gra).toBeUndefined();
    expect(early.state.activeClue?.lockouts.gra).toBe(open - 250);

    const stillLocked = run(early.state, { type: "buzz", actorId: "gra" }, open - 300);
    expect(stillLocked.events[0]).toMatchObject({ reason: "buzz-locked-out" });

    const allowed = run(early.state, { type: "buzz", actorId: "gra" }, open + 10);
    expect(allowed.state.activeClue?.buzzes.gra).toBe(open + 10);
  });

  it("does not penalise anyone when the lockout is disabled", () => {
    const state = playClue(room({ earlyBuzzLockoutMs: 0 }), "j-200");
    const open = state.activeClue!.readoutEndsAt!;

    const early = run(state, { type: "buzz", actorId: "gra" }, open - 500);
    expect(early.events[0]).toMatchObject({ reason: "buzz-not-open" });
    expect(early.state.activeClue?.lockouts).toEqual({});
  });
});

describe("wager windows", () => {
  it("gives a Daily Double its own window and reports when it opened", () => {
    const state = playClue(room({ wagerTimeoutMs: 20_000 }), "j-dd", 1_000);
    const active = state.activeClue!;

    expect(active.wagerWindowStartsAt).toBe(1_000);
    expect(active.wagerWindowEndsAt).toBe(21_000);
  });
});
