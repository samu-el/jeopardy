import { describe, expect, it } from "vitest";
import {
  createGame,
  dispatchGameCommand,
  getPublicGameState,
  maxPlayersPerRoom,
  type GameClue,
  type GameCommand,
  type GameState,
} from "@/lib/game";

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
    id: "j-400",
    round: "jeopardy",
    category: "Planets",
    value: 400,
    clue: "The ringed planet.",
    correctResponse: "Saturn",
  },
];

function emptyRoom(settings: Partial<GameState["settings"]> = {}) {
  return createGame({
    roomId: "room-mp",
    players: [],
    clues,
    now: 0,
    settings: { autoAdvanceMs: 0, ...settings },
  });
}

function run(state: GameState, command: GameCommand, now = 0) {
  return dispatchGameCommand(state, command, { now });
}

describe("joining a room", () => {
  it("seats the first human as host and picker", () => {
    const result = run(emptyRoom(), {
      type: "join-game",
      actorId: "ada",
      displayName: "Ada",
    });

    expect(result.state.players.ada.kind).toBe("human");
    expect(result.state.settings.hostId).toBe("ada");
    expect(result.events).toEqual([
      { type: "player-joined", playerId: "ada", displayName: "Ada", rejoined: false },
    ]);
  });

  it("treats a repeat join as a reconnect and keeps the score", () => {
    let state = run(emptyRoom(), {
      type: "join-game",
      actorId: "ada",
      displayName: "Ada",
    }).state;
    state = { ...state, scores: { ...state.scores, ada: 1_200 } };
    state.players.ada.connected = false;

    const result = run(state, {
      type: "join-game",
      actorId: "ada",
      displayName: "Ada",
    });

    expect(result.state.players.ada.connected).toBe(true);
    expect(result.state.scores.ada).toBe(1_200);
    expect(result.events[0]).toMatchObject({ rejoined: true });
    expect(Object.keys(result.state.players)).toHaveLength(1);
  });

  it("does not promote a later joiner over the existing host", () => {
    let state = run(emptyRoom(), {
      type: "join-game",
      actorId: "ada",
      displayName: "Ada",
    }).state;
    state = run(state, {
      type: "join-game",
      actorId: "grace",
      displayName: "Grace",
    }).state;

    expect(state.settings.hostId).toBe("ada");
    expect(state.scores.grace).toBe(0);
  });

  it("trims names and refuses to overfill the room", () => {
    let state = emptyRoom();
    for (let index = 0; index < maxPlayersPerRoom; index += 1) {
      state = run(state, {
        type: "join-game",
        actorId: `p${index}`,
        displayName: `   Player   ${index}  `,
      }).state;
    }
    expect(state.players.p0.displayName).toBe("Player 0");

    const overflow = run(state, {
      type: "join-game",
      actorId: "late",
      displayName: "Late",
    });
    expect(overflow.events[0]).toMatchObject({ reason: "room-full" });
    expect(overflow.state.players.late).toBeUndefined();
  });
});

describe("leaving a room", () => {
  function twoPlayerRoom() {
    let state = run(emptyRoom(), {
      type: "join-game",
      actorId: "ada",
      displayName: "Ada",
    }).state;
    state = run(
      state,
      { type: "join-game", actorId: "grace", displayName: "Grace" },
      5,
    ).state;
    return state;
  }

  it("migrates the host to the next longest-seated human", () => {
    const left = run(twoPlayerRoom(), { type: "leave-game", actorId: "ada" });

    expect(left.state.players.ada).toBeUndefined();
    expect(left.state.settings.hostId).toBe("grace");

    const started = run(left.state, { type: "start-game", actorId: "grace" }, 20);
    expect(started.state.pickerId).toBe("grace");
  });

  it("hands the picker seat over when the picker walks away mid-round", () => {
    let state = twoPlayerRoom();
    state = run(state, { type: "start-game", actorId: "ada" }, 10).state;
    expect(state.pickerId).toBe("ada");

    state = run(state, { type: "leave-game", actorId: "ada" }, 11).state;
    expect(state.settings.hostId).toBe("grace");
    expect(state.pickerId).toBe("grace");
  });

  it("lets the host remove someone else but blocks a guest from doing so", () => {
    const room = twoPlayerRoom();
    const kicked = run(room, {
      type: "leave-game",
      actorId: "ada",
      targetPlayerId: "grace",
    });
    expect(kicked.state.players.grace).toBeUndefined();

    const blocked = run(room, {
      type: "leave-game",
      actorId: "grace",
      targetPlayerId: "ada",
    });
    expect(blocked.events[0]).toMatchObject({ reason: "not-authorized" });
    expect(blocked.state.players.ada).toBeDefined();
  });

  it("drops a departing player out of the live clue", () => {
    let state = twoPlayerRoom();
    state = run(state, { type: "start-game", actorId: "ada" }, 10).state;
    state = run(
      state,
      { type: "pick-clue", actorId: "ada", clueId: "j-200" },
      10,
    ).state;
    const openAt = state.activeClue!.readoutEndsAt!;
    state = run(state, { type: "buzz", actorId: "grace" }, openAt).state;
    expect(state.activeClue!.buzzes.grace).toBeDefined();

    state = run(state, { type: "leave-game", actorId: "grace" }, openAt + 1).state;
    expect(state.activeClue!.buzzes.grace).toBeUndefined();
  });
});

describe("profiles", () => {
  it("shares avatar choices through the public state", () => {
    let state = run(emptyRoom(), {
      type: "join-game",
      actorId: "ada",
      displayName: "Ada",
    }).state;
    state = run(state, {
      type: "set-player-profile",
      actorId: "ada",
      emoji: "🦊",
      color: "#ff8800",
    }).state;

    const publicState = getPublicGameState(state, 0);
    expect(publicState.players[0]).toMatchObject({ emoji: "🦊", color: "#ff8800" });
  });

  it("stops a guest from editing another player", () => {
    let state = run(emptyRoom(), {
      type: "join-game",
      actorId: "ada",
      displayName: "Ada",
    }).state;
    state = run(state, {
      type: "join-game",
      actorId: "grace",
      displayName: "Grace",
    }).state;

    const result = run(state, {
      type: "set-player-profile",
      actorId: "grace",
      targetPlayerId: "ada",
      displayName: "Hacked",
    });
    expect(result.events[0]).toMatchObject({ reason: "not-authorized" });
    expect(result.state.players.ada.displayName).toBe("Ada");
  });
});

describe("loading a different board", () => {
  it("replaces the clue set and resets progress for the host", () => {
    let state = run(emptyRoom(), {
      type: "join-game",
      actorId: "ada",
      displayName: "Ada",
    }).state;
    state = run(state, { type: "start-game", actorId: "ada" }).state;
    state = run(state, { type: "pick-clue", actorId: "ada", clueId: "j-200" }).state;

    const loaded = run(state, {
      type: "load-game",
      actorId: "ada",
      clues: [
        {
          id: "new-1",
          round: "jeopardy",
          category: "Fresh",
          value: 200,
          clue: "New clue.",
          correctResponse: "New",
        },
      ],
    });

    expect(loaded.state.round).toBe("lobby");
    expect(loaded.state.activeClue).toBeUndefined();
    expect(loaded.state.revealedClueIds).toEqual([]);
    expect(Object.keys(loaded.state.cluesById)).toEqual(["new-1"]);
    expect(loaded.state.scores.ada).toBe(0);
  });

  it("rejects a non-host and duplicate clue ids", () => {
    let state = run(emptyRoom(), {
      type: "join-game",
      actorId: "ada",
      displayName: "Ada",
    }).state;
    state = run(state, {
      type: "join-game",
      actorId: "grace",
      displayName: "Grace",
    }).state;

    expect(
      run(state, { type: "load-game", actorId: "grace", clues }).events[0],
    ).toMatchObject({ reason: "not-authorized" });
    expect(
      run(state, { type: "load-game", actorId: "ada", clues: [clues[0], clues[0]] })
        .events[0],
    ).toMatchObject({ reason: "invalid-command" });
  });
});
