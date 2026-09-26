import { describe, expect, it } from "vitest";
import type { PublicPlayerState } from "@/lib/game";
import { computeResults, joinNames, ordinal } from "@/lib/game/results";
import { formatMoney } from "@/lib/foundation/money";

function player(
  id: string,
  score: number,
  extra: Partial<PublicPlayerState> = {},
): PublicPlayerState {
  return {
    id,
    displayName: id[0].toUpperCase() + id.slice(1),
    kind: "human",
    connected: true,
    spectator: false,
    score,
    ...extra,
  };
}

describe("computeResults", () => {
  it("never lists or crowns a spectator, even when every contestant is below $0", () => {
    const results = computeResults([
      player("display", 0, { spectator: true }),
      player("ada", -400),
      player("grace", -200),
    ]);
    expect(results.standings.map((entry) => entry.player.id)).toEqual(["grace", "ada"]);
    expect(results.winners.map((winner) => winner.id)).toEqual(["grace"]);
    expect(results.tie).toBe(false);
  });

  it("gives tied players the same rank and makes them all winners", () => {
    const results = computeResults([
      player("ada", 800),
      player("grace", 800),
      player("linus", 200),
    ]);
    expect(results.standings.map((entry) => entry.rank)).toEqual([1, 1, 3]);
    expect(results.winners.map((winner) => winner.id)).toEqual(["ada", "grace"]);
    expect(results.tie).toBe(true);
    expect(results.standings[0].tied).toBe(true);
    expect(results.standings[2].tied).toBe(false);
  });

  it("has no winner in a room with no contestants", () => {
    const results = computeResults([player("display", 0, { spectator: true })]);
    expect(results.standings).toEqual([]);
    expect(results.winners).toEqual([]);
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
