import { describe, expect, it } from "vitest";
import {
  createSeededRng,
  decideBotAnswer,
  decideBotBuzz,
  decideBotWager,
} from "@/lib/ai";
import { baselineBotProfiles } from "@/lib/foundation/game-contracts";
import type { GameClue } from "@/lib/game";

const clue: GameClue = {
  id: "c1",
  round: "jeopardy",
  category: "Test",
  value: 400,
  clue: "A test clue",
  correctResponse: "the answer",
};

describe("bot decisions", () => {
  it("returns deterministic buzz delays for the same seed", () => {
    const a = createSeededRng(1234);
    const b = createSeededRng(1234);
    const decisionA = decideBotBuzz(baselineBotProfiles[2], clue, a);
    const decisionB = decideBotBuzz(baselineBotProfiles[2], clue, b);
    expect(decisionA).toEqual(decisionB);
  });

  it("higher difficulty buzzes faster on average", () => {
    const rookieRng = createSeededRng(99);
    const legendRng = createSeededRng(99);
    let rookieTotal = 0;
    let legendTotal = 0;
    let rookieCount = 0;
    let legendCount = 0;
    for (let i = 0; i < 200; i += 1) {
      const r = decideBotBuzz(baselineBotProfiles[0], clue, rookieRng);
      const l = decideBotBuzz(baselineBotProfiles[3], clue, legendRng);
      if (r.shouldBuzz) {
        rookieTotal += r.buzzDelayMs;
        rookieCount += 1;
      }
      if (l.shouldBuzz) {
        legendTotal += l.buzzDelayMs;
        legendCount += 1;
      }
    }
    expect(legendCount).toBeGreaterThan(rookieCount);
    if (legendCount > 0 && rookieCount > 0) {
      expect(legendTotal / legendCount).toBeLessThan(rookieTotal / rookieCount);
    }
  });

  it("returns the correct answer some of the time and scrambles otherwise", () => {
    const rng = createSeededRng(7);
    let exact = 0;
    let attempted = 0;
    for (let i = 0; i < 200; i += 1) {
      const decision = decideBotAnswer(baselineBotProfiles[2], clue, rng);
      if (decision.isAttempting) attempted += 1;
      if (decision.answer === clue.correctResponse) exact += 1;
    }
    expect(attempted).toBeGreaterThan(0);
    expect(exact).toBeGreaterThan(0);
  });

  it("wagers within available score for daily double", () => {
    const rng = createSeededRng(1);
    const amount = decideBotWager({
      profile: baselineBotProfiles[2],
      clue,
      currentScore: 2_000,
      leaderScore: 2_000,
      round: "jeopardy",
      rng,
    });
    expect(amount).toBeLessThanOrEqual(2_000);
    expect(amount).toBeGreaterThanOrEqual(5);
  });

  it("wagers zero for final-jeopardy when score is non-positive", () => {
    const rng = createSeededRng(1);
    const amount = decideBotWager({
      profile: baselineBotProfiles[2],
      clue: { ...clue, round: "final-jeopardy" },
      currentScore: 0,
      leaderScore: 5_000,
      round: "final-jeopardy",
      rng,
    });
    expect(amount).toBe(0);
  });
});
