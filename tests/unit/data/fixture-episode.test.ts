import { describe, expect, it } from "vitest";
import { normalizeArchivedEpisode } from "@/lib/data";
import { fixtureEpisode } from "@/lib/data/fixture-episode";

describe("fixture episode", () => {
  it("normalizes into a playable game with at least one final clue", () => {
    const result = normalizeArchivedEpisode(fixtureEpisode, { id: "fixture" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.game.clues.length).toBeGreaterThan(0);
    expect(result.game.clues.some((clue) => clue.round === "final-jeopardy")).toBe(true);
  });
});
