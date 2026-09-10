import { describe, expect, it } from "vitest";
import {
  createGame,
  dispatchGameCommand,
  ensureHost,
  type GameClue,
  type GameCommand,
  type GamePlayer,
  type GameState,
} from "@/lib/game";

function run(state: GameState, command: GameCommand, now: number) {
  return dispatchGameCommand(state, command, { now });
}

const clues: GameClue[] = [
  {
    id: "j-200",
    round: "jeopardy",
    category: "Planets",
    value: 200,
    clue: "The red planet.",
    correctResponse: "Mars",
  },
];

function player(id: string, patch: Partial<GamePlayer> = {}): GamePlayer {
  return {
    id,
    displayName: id,
    kind: "human",
    connected: true,
    spectator: false,
    ...patch,
  };
}

function room(players: GamePlayer[], hostId?: string): GameState {
  const state = createGame({
    roomId: "R1",
    players,
    clues,
    settings: hostId ? { hostId } : undefined,
    now: 0,
  });
  return state;
}

/**
 * The board only opens for the host, so a chair held by someone who is not
 * here is a room nobody can play. These are the ways that happens.
 */
describe("the host chair", () => {
  it("stays with a host who is still connected", () => {
    const state = room([player("p1"), player("p2")], "p1");
    expect(ensureHost(state).settings.hostId).toBe("p1");
  });

  it("stays with a host who is not playing", () => {
    // Hosting without a lectern is a choice, not an accident: a present
    // spectator host must not be demoted just for being a spectator.
    const state = room([player("p1", { spectator: true }), player("p2")], "p1");
    expect(ensureHost(state).settings.hostId).toBe("p1");
  });

  it("moves to the one person left when the host is gone", () => {
    const state = room([player("p1", { connected: false }), player("p2")], "p1");
    expect(ensureHost(state).settings.hostId).toBe("p2");
  });

  it("prefers a contestant over a spectator", () => {
    // A television joins to watch. It should not end up holding the board.
    const state = room(
      [
        player("p1", { connected: false }),
        player("tv", { spectator: true, joinedAt: 1 }),
        player("p2", { joinedAt: 2 }),
      ],
      "p1",
    );
    expect(ensureHost(state).settings.hostId).toBe("p2");
  });

  it("gives the chair to whoever joins a room that came back empty", () => {
    // A room restored from storage records its old host and nobody
    // connected. Without this, the first person in finds a board they
    // cannot touch — and alone, no one is coming to hand it over.
    const restored = room([player("p1", { connected: false })], "p1");
    const joined = run(
      restored,
      { type: "join-game", actorId: "p2", displayName: "Zelda" },
      1,
    );
    expect(joined.state.settings.hostId).toBe("p2");
  });

  it("lets that person actually open a clue", () => {
    const restored = room([player("p1", { connected: false })], "p1");
    const joined = run(
      restored,
      { type: "join-game", actorId: "p2", displayName: "Zelda" },
      1,
    );
    const started = run(joined.state, { type: "start-game", actorId: "p2" }, 2);
    const picked = run(
      { ...started.state, roundIntroEndsAt: undefined },
      { type: "pick-clue", actorId: "p2", clueId: "j-200" },
      3,
    );
    expect(picked.state.activeClue?.clueId).toBe("j-200");
  });

  it("leaves the chair empty rather than with a ghost when nobody is here", () => {
    // An empty chair is an open room: anyone who arrives can run it. A chair
    // held by a ghost is a room that is locked forever.
    const state = room([player("p1", { connected: false })], "p1");
    expect(ensureHost(state).settings.hostId).toBeUndefined();
  });
});
