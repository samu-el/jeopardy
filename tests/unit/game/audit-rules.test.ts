/**
 * Rules the 2026-09 UX audit found the engine getting wrong. Each block names
 * the finding it pins down.
 */
import { describe, expect, it } from "vitest";
import {
  createGame,
  dispatchGameCommand,
  getPublicGameState,
  leadingOpponentScore,
  wagerLimitsFor,
  type GameClue,
  type GameCommand,
  type GamePlayer,
  type GameSettings,
  type GameState,
} from "@/lib/game";

const human = (id: string, displayName: string, extra: Partial<GamePlayer> = {}): GamePlayer => ({
  id,
  displayName,
  kind: "human",
  connected: true,
  spectator: false,
  ...extra,
});

const clues: GameClue[] = [
  { id: "j-1", round: "jeopardy", category: "A", value: 200, clue: "One.", correctResponse: "Uno" },
  { id: "j-2", round: "jeopardy", category: "A", value: 1_000, clue: "Two.", correctResponse: "Dos" },
  {
    id: "j-dd",
    round: "jeopardy",
    category: "B",
    value: 400,
    clue: "Daily.",
    correctResponse: "Double",
    dailyDouble: true,
  },
  { id: "dj-1", round: "double-jeopardy", category: "C", value: 400, clue: "Three.", correctResponse: "Tres" },
  { id: "f-1", round: "final-jeopardy", category: "F", value: 0, clue: "Final.", correctResponse: "Last" },
];

/** A host who only runs the board, two contestants, and a TV. */
function room(settings: Partial<GameSettings> = {}, players?: GamePlayer[]) {
  return createGame({
    roomId: "audit",
    players: players ?? [
      human("host", "Host", { spectator: true }),
      human("zed", "Zed"),
      human("amy", "Amy"),
      human("tv", "Display", { spectator: true }),
    ],
    clues,
    now: 0,
    settings: { hostId: "host", buzzUnlockDelayMs: 100, answerTimeoutMs: 5_000, ...settings },
  });
}

function run(state: GameState, command: GameCommand, now: number) {
  return dispatchGameCommand(state, command, { now });
}

function started(settings: Partial<GameSettings> = {}, players?: GamePlayer[]) {
  return run(room(settings, players), { type: "start-game", actorId: "host" }, 10).state;
}

/** One contestant rings in on a standard clue and answers. */
function answered(state: GameState, clueId: string, playerId: string, answer: string, t: number) {
  let s = run(state, { type: "pick-clue", actorId: "host", clueId }, t).state;
  s = run(s, { type: "buzz", actorId: playerId }, t + 200).state;
  return run(s, { type: "submit-answer", actorId: playerId, answer }, t + 300).state;
}

function judge(state: GameState, target: string, correct: boolean, t: number) {
  return run(state, { type: "judge-answer", actorId: "host", targetPlayerId: target, correct }, t)
    .state;
}

describe("[P0] the correct response is not shown before a rebound", () => {
  it("withholds the response from the table while someone could still ring in", () => {
    const s = answered(started(), "j-1", "zed", "Nope", 20);
    const table = getPublicGameState(s, 400).currentClue!;
    expect(table.answers).toEqual({ zed: "Nope" });
    expect(table.correctResponse).toBeUndefined();
    expect(table.responseFinal).toBe(false);
    expect(JSON.stringify(getPublicGameState(s, 400))).not.toContain("Uno");

    // The host running the board can read the card to rule on it.
    expect(getPublicGameState(s, 400, { viewerId: "host" }).currentClue?.correctResponse).toBe(
      "Uno",
    );
    // A contestant asking to be treated as a viewer learns nothing.
    expect(
      getPublicGameState(s, 400, { viewerId: "amy" }).currentClue?.correctResponse,
    ).toBeUndefined();
  });

  it("keeps it hidden through the rebound, and shows it once nobody is left", () => {
    let s = answered(started(), "j-1", "zed", "Nope", 20);
    s = judge(s, "zed", false, 500);
    let table = getPublicGameState(s, 600).currentClue!;
    expect(table.correctResponse).toBeUndefined();
    expect(table.rebound).toBe(true);
    expect(table.phase).toBe("buzzing");
    // The miss stays on the record so the table can see what was said.
    expect(table.answers).toEqual({ zed: "Nope" });

    s = run(s, { type: "buzz", actorId: "amy" }, 700).state;
    s = run(s, { type: "submit-answer", actorId: "amy", answer: "Also no" }, 800).state;
    // Amy is the last contestant: no rebound is possible, so the response is out.
    table = getPublicGameState(s, 900).currentClue!;
    expect(table.responseFinal).toBe(true);
    expect(table.correctResponse).toBe("Uno");
  });

  it("does not show a seated host the card while they could still rebound", () => {
    const players = [human("host", "Host"), human("amy", "Amy")];
    const s = answered(started({}, players), "j-1", "amy", "Nope", 20);
    expect(
      getPublicGameState(s, 400, { viewerId: "host" }).currentClue?.correctResponse,
    ).toBeUndefined();
  });
});

describe("[P1] a wrong Daily Double answer ends the clue", () => {
  it("does not reopen buzzing for the table", () => {
    let s = started();
    s = { ...s, pickerId: "zed" };
    s = run(s, { type: "pick-clue", actorId: "zed", clueId: "j-dd" }, 20).state;
    s = run(s, { type: "submit-wager", actorId: "zed", amount: 500 }, 30).state;
    // Announced straight away, as on the show.
    expect(getPublicGameState(s, 40).currentClue?.wagers).toEqual({ zed: 500 });
    s = run(s, { type: "submit-answer", actorId: "zed", answer: "Wrong" }, 300).state;
    s = judge(s, "zed", false, 350);

    expect(s.activeClue?.canAdvance).toBe(true);
    expect(s.activeClue?.answerRevealed).toBe(true);
    expect(s.activeClue?.buzzWindowEndsAt).not.toBeGreaterThan(350);
    const table = getPublicGameState(s, 360).currentClue!;
    expect(table.correctResponse).toBe("Double");
    expect(table.phase).toBe("resolved");
    expect(table.rebound).toBe(false);
    expect(s.scores.zed).toBe(-500);
  });
});

describe("[P0] spectators and displays are never contestants", () => {
  it("leaves them out of standings, head counts and results", () => {
    let s = started();
    // Both contestants finish in the red; the TV and the host sit at $0.
    s = answered(s, "j-1", "zed", "x", 20);
    s = judge(s, "zed", false, 400);
    s = run(s, { type: "buzz", actorId: "amy" }, 500).state;
    s = run(s, { type: "submit-answer", actorId: "amy", answer: "y" }, 600).state;
    s = judge(s, "amy", false, 700);
    const view = getPublicGameState(s, 800);
    expect(view.standings?.map((entry) => entry.playerId)).toEqual(["zed", "amy"]);
    expect(view.audience).toEqual({ contestants: 2, spectators: 2, connectedContestants: 2 });

    const over = { ...s, round: "complete" as const, activeClue: undefined };
    const results = getPublicGameState(over, 900).results!;
    expect(results.leaders).toEqual(["zed", "amy"]);
    // Nobody finished in the black, so nobody won — least of all the TV.
    expect(results.winners).toEqual([]);
  });

  it("does not ask spectators for a Final wager", () => {
    let s = started();
    s = { ...s, scores: { ...s.scores, zed: 400, amy: 400 } };
    s = { ...s, revealedClueIds: ["j-1", "j-2", "j-dd"], round: "double-jeopardy" };
    s = run(s, { type: "pick-clue", actorId: "host", clueId: "dj-1" }, 20).state;
    s = run(s, { type: "reveal-answer", actorId: "host" }, 30).state;
    s = run(s, { type: "skip", actorId: "host" }, 40).state;
    expect(s.round).toBe("final-jeopardy");
    expect(s.activeClue?.waitingForWager).toEqual(["zed", "amy"]);
  });
});

describe("[P2] ties", () => {
  it("names every tied leader a winner", () => {
    let s = started();
    s = { ...s, round: "complete", scores: { ...s.scores, zed: 800, amy: 800 } };
    const view = getPublicGameState(s, 50);
    expect(view.results?.winners).toEqual(["zed", "amy"]);
    expect(view.standings?.map((entry) => entry.rank)).toEqual([1, 1]);
  });
});

describe("[P2] Final Jeopardy is for contestants in the black", () => {
  function toFinal(scores: Record<string, number>) {
    let s = started();
    s = { ...s, scores: { ...s.scores, ...scores } };
    s = { ...s, revealedClueIds: ["j-1", "j-2", "j-dd"], round: "double-jeopardy" };
    s = run(s, { type: "pick-clue", actorId: "host", clueId: "dj-1" }, 20).state;
    s = run(s, { type: "reveal-answer", actorId: "host" }, 30).state;
    return run(s, { type: "skip", actorId: "host" }, 40).state;
  }

  it("gives a player at or below $0 no wager box and does not wait on them", () => {
    let s = toFinal({ zed: 1_000, amy: -200 });
    expect(s.activeClue?.waitingForWager).toEqual(["zed"]);
    expect(Object.keys(getPublicGameState(s, 50).currentClue!.wagerLimits)).toEqual(["zed"]);
    s = run(s, { type: "submit-wager", actorId: "zed", amount: 600 }, 60).state;
    // One wager in and the clue is up: nobody else is owed.
    expect(s.activeClue?.clueRevealed).toBe(true);
    expect(Object.keys(s.activeClue!.buzzes)).toEqual(["zed"]);
    expect(
      run(s, { type: "submit-answer", actorId: "amy", answer: "Last" }, 300).events[0],
    ).toMatchObject({ type: "command-rejected" });
  });

  it("reveals Final answers and wagers publicly, and keeps them for the results", () => {
    let s = toFinal({ zed: 1_000, amy: 600 });
    s = run(s, { type: "submit-wager", actorId: "zed", amount: 300 }, 60).state;
    s = run(s, { type: "submit-wager", actorId: "amy", amount: 600 }, 70).state;
    s = run(s, { type: "submit-answer", actorId: "zed", answer: "Last" }, 300).state;
    expect(getPublicGameState(s, 310).currentClue?.wagers).toEqual({});
    s = run(s, { type: "submit-answer", actorId: "amy", answer: "First" }, 320).state;
    const reveal = getPublicGameState(s, 330).currentClue!;
    expect(reveal.kind).toBe("final");
    expect(reveal.answers).toEqual({ zed: "Last", amy: "First" });
    expect(reveal.wagers).toEqual({ zed: 300, amy: 600 });
    expect(reveal.correctResponse).toBe("Last");

    s = judge(s, "amy", false, 400);
    s = judge(s, "zed", true, 410);
    s = run(s, { type: "skip", actorId: "host" }, 420).state;
    expect(s.round).toBe("complete");
    const results = getPublicGameState(s, 430).results!;
    expect(results.winners).toEqual(["zed"]);
    expect(results.finalJeopardy).toMatchObject({
      category: "F",
      correctResponse: "Last",
      entries: [
        { playerId: "amy", answer: "First", wager: 600, correct: false },
        { playerId: "zed", answer: "Last", wager: 300, correct: true },
      ],
    });
  });

  it("plays the clue out with nobody wagering when no one is in the black", () => {
    let s = toFinal({ zed: 0, amy: -400 });
    expect(s.activeClue?.waitingForWager).toEqual([]);
    expect(s.activeClue?.clueRevealed).toBe(true);
    s = run(s, { type: "tick" }, 60_000).state;
    expect(s.activeClue?.canAdvance).toBe(true);
    s = run(s, { type: "skip", actorId: "host" }, 60_100).state;
    expect(s.round).toBe("complete");
  });
});

describe("[P2] wagers say why they were changed", () => {
  function ddFor(score: number) {
    let s = started();
    s = { ...s, pickerId: "zed", scores: { ...s.scores, zed: score } };
    return run(s, { type: "pick-clue", actorId: "zed", clueId: "j-dd" }, 20).state;
  }

  it.each([
    [3, 5, "below-min"],
    [Number.NaN, 5, "not-a-number"],
    [1_500, 1_000, "above-max"],
  ] as const)("wager %s becomes %s (%s)", (requested, amount, adjusted) => {
    const result = run(ddFor(200), { type: "submit-wager", actorId: "zed", amount: requested }, 30);
    expect(result.events[0]).toMatchObject({ type: "wager-submitted", amount, adjusted });
  });

  it("takes an in-range wager as sent, with no adjustment", () => {
    const result = run(ddFor(200), { type: "submit-wager", actorId: "zed", amount: 700 }, 30);
    expect(result.events[0]).toEqual({
      type: "wager-submitted",
      clueId: "j-dd",
      actorId: "zed",
      amount: 700,
      min: 5,
      max: 1_000,
    });
  });

  it("publishes the limits while the wager is open", () => {
    expect(getPublicGameState(ddFor(200), 25).currentClue?.wagerLimits).toEqual({
      zed: { min: 5, max: 1_000, maxIsScore: false },
    });
  });
});

describe("[P2] a true Daily Double", () => {
  it("is the round's top clue when trailing it, and the score when above it", () => {
    const s = started();
    expect(wagerLimitsFor({ ...s, scores: { zed: 200 } }, "zed", "jeopardy")).toEqual({
      min: 5,
      max: 1_000,
      maxIsScore: false,
    });
    expect(wagerLimitsFor({ ...s, scores: { zed: 3_000 } }, "zed", "jeopardy")).toEqual({
      min: 5,
      max: 3_000,
      maxIsScore: true,
    });
    // Double Jeopardy's board here tops out at $400.
    expect(wagerLimitsFor({ ...s, scores: { zed: 0 } }, "zed", "double-jeopardy").max).toBe(400);
  });
});

describe("[P2] who opens each round", () => {
  it("opens later rounds with the trailing contestant, not a seated host", () => {
    const players = [human("host", "Host", { joinedAt: 1 }), human("amy", "Amy", { joinedAt: 2 })];
    let s = started({}, players);
    expect(s.pickerId).toBe("host");
    s = { ...s, scores: { host: 1_000, amy: 200 }, revealedClueIds: ["j-1", "j-2"] };
    s = run(s, { type: "pick-clue", actorId: "host", clueId: "j-dd" }, 20).state;
    s = run(s, { type: "submit-wager", actorId: "host", amount: 5 }, 30).state;
    s = run(s, { type: "reveal-answer", actorId: "host" }, 40).state;
    s = run(s, { type: "skip", actorId: "host" }, 50).state;
    expect(s.round).toBe("double-jeopardy");
    expect(s.pickerId).toBe("amy");
  });

  it("breaks a tie for the lowest score by seat", () => {
    let s = started();
    s = { ...s, revealedClueIds: ["j-1", "j-2"] };
    s = { ...s, pickerId: "zed" };
    s = run(s, { type: "pick-clue", actorId: "zed", clueId: "j-dd" }, 20).state;
    s = run(s, { type: "submit-wager", actorId: "zed", amount: 5 }, 30).state;
    s = run(s, { type: "reveal-answer", actorId: "host" }, 40).state;
    s = run(s, { type: "skip", actorId: "host" }, 50).state;
    // Both at $0: Zed sat down first.
    expect(s.pickerId).toBe("zed");
  });
});

describe("[P1] podiums keep their seats", () => {
  it("lists players in seat order whatever the scores, and ranks separately", () => {
    let s = answered(started(), "j-1", "amy", "Uno", 20);
    s = judge(s, "amy", true, 400);
    const view = getPublicGameState(s, 500);
    expect(view.players.map((player) => player.id)).toEqual(["host", "zed", "amy", "tv"]);
    expect(view.standings?.[0]).toEqual({ playerId: "amy", score: 200, rank: 1 });
  });
});

describe("[P1] undo reverses a ruling", () => {
  it("puts back the score and the judging position after a wrong ruling", () => {
    let s = answered(started(), "j-1", "zed", "Uno", 20);
    s = judge(s, "zed", false, 400);
    expect(s.scores.zed).toBe(-200);
    expect(s.activeClue?.answerRevealed).toBe(false);

    const undone = run(s, { type: "undo", actorId: "host" }, 450);
    expect(undone.events).toEqual([{ type: "undo-applied" }]);
    s = undone.state;
    expect(s.scores.zed).toBe(0);
    expect(s.activeClue?.judges).toEqual({});
    expect(s.activeClue?.currentJudgePlayerId).toBe("zed");

    s = judge(s, "zed", true, 500);
    expect(s.scores.zed).toBe(200);
    expect(s.pickerId).toBe("zed");
  });

  it("is host-only", () => {
    let s = answered(started(), "j-1", "zed", "Uno", 20);
    s = judge(s, "zed", false, 400);
    expect(run(s, { type: "undo", actorId: "zed" }, 450).events[0]).toMatchObject({
      type: "command-rejected",
      reason: "not-authorized",
    });
  });
});

describe("[P2] phase, time's up and auto-advance are public", () => {
  it("walks a clue through its phases", () => {
    let s = started({ buzzWindowMs: 1_000, autoAdvanceMs: 3_000 });
    s = run(s, { type: "pick-clue", actorId: "host", clueId: "j-1" }, 20).state;
    expect(getPublicGameState(s, 50).currentClue).toMatchObject({
      kind: "standard",
      phase: "reading",
    });
    expect(getPublicGameState(s, 200).currentClue?.phase).toBe("buzzing");
    s = run(s, { type: "tick" }, 5_000).state;
    const timedOut = getPublicGameState(s, 5_000).currentClue!;
    expect(timedOut).toMatchObject({ phase: "resolved", timedOut: true, correctResponse: "Uno" });
    // The auto-advance deadline is on the wire so a client can count it down.
    expect(timedOut.closesAt).toBe(8_000);
  });

  it("reports answering and judging", () => {
    let s = run(started(), { type: "pick-clue", actorId: "host", clueId: "j-1" }, 20).state;
    s = run(s, { type: "buzz", actorId: "zed" }, 200).state;
    expect(getPublicGameState(s, 210).currentClue?.phase).toBe("answering");
    s = run(s, { type: "submit-answer", actorId: "zed", answer: "?" }, 300).state;
    expect(getPublicGameState(s, 310).currentClue?.phase).toBe("judging");
  });
});

describe("leading opponent score", () => {
  it("ignores the player's own score and spectators", () => {
    const s = { ...started(), scores: { host: 0, zed: 20_000, amy: 5_000, tv: 99_999 } };
    expect(leadingOpponentScore(s, "zed")).toBe(5_000);
    expect(leadingOpponentScore(s, "amy")).toBe(20_000);
  });
});
