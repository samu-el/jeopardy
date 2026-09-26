import { describe, expect, it } from "vitest";
import {
  createGame,
  getPublicGameState,
  type GamePlayer,
  type PublicGameState,
} from "@/lib/game";
import { computeResults, joinNames, ordinal } from "@/lib/game/results";
import { formatMoney } from "@/lib/foundation/money";

const seat = (id: string, spectator = false): GamePlayer => ({
  id,
  displayName: id[0].toUpperCase() + id.slice(1),
  kind: "human",
  connected: true,
  spectator,
});

/** A finished game with these scores, as the room would project it. */
function finished(scores: Record<string, number>, spectators: string[] = []): PublicGameState {
  const state = createGame({
    roomId: "r",
    players: [...Object.keys(scores).map((id) => seat(id)), ...spectators.map((id) => seat(id, true))],
    clues: [],
    now: 0,
  });
  return getPublicGameState({ ...state, round: "complete", scores: { ...state.scores, ...scores } }, 1);
}

describe("computeResults", () => {
  it("never lists or crowns a spectator, and nobody wins below $0", () => {
    const results = computeResults(finished({ ada: -400, grace: -200 }, ["display"]));
    expect(results.standings.map((entry) => entry.player.id)).toEqual(["grace", "ada"]);
    expect(results.winners).toEqual([]);
    expect(results.leaders.map((leader) => leader.id)).toEqual(["grace"]);
    expect(results.standings.every((entry) => !entry.winner)).toBe(true);
  });

  it("gives tied players the same rank and makes them all winners", () => {
    const results = computeResults(finished({ ada: 800, grace: 800, linus: 200 }));
    expect(results.standings.map((entry) => entry.rank)).toEqual([1, 1, 3]);
    expect(results.winners.map((winner) => winner.id).sort()).toEqual(["ada", "grace"]);
    expect(results.tie).toBe(true);
    expect(results.standings[0].tied).toBe(true);
    expect(results.standings[2].tied).toBe(false);
  });

  it("ranks from the players when an older room sends no standings", () => {
    const view = finished({ ada: 400, grace: 600 }, ["display"]);
    const results = computeResults({ ...view, standings: undefined, results: undefined });
    expect(results.standings.map((entry) => entry.player.id)).toEqual(["grace", "ada"]);
    expect(results.winners.map((winner) => winner.id)).toEqual(["grace"]);
  });
});

describe("formatting", () => {
  it("writes negative money with the sign before the dollar", () => {
    expect(formatMoney(-400)).toBe("-$400");
    expect(formatMoney(0)).toBe("$0");
    expect(formatMoney(1200)).toBe("$1200");
    expect(formatMoney(400, { signed: true })).toBe("+$400");
    expect(formatMoney(-400, { signed: true })).toBe("-$400");
  });

  it("joins names and ranks for people", () => {
    expect(joinNames(["Ada"])).toBe("Ada");
    expect(joinNames(["Ada", "Grace"])).toBe("Ada & Grace");
    expect(joinNames(["Ada", "Grace", "Linus"])).toBe("Ada, Grace & Linus");
    expect([1, 2, 3, 4, 11, 12, 13, 21].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
    ]);
  });
});
