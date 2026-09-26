import { describe, expect, it } from "vitest";
import {
  BotClueMemory,
  correctWhenKnown,
  createSeededRng,
  decideBotAnswer,
  decideBotBuzz,
  decideBotWager,
  decideFinalWager,
  judgeAnswer,
  makeWrongAnswer,
} from "@/lib/ai";
import { baselineBotProfiles } from "@/lib/ai/profiles";
import type { GameClue } from "@/lib/game";

const clue: GameClue = {
  id: "c1",
  round: "jeopardy",
  category: "Test",
  value: 400,
  clue: "A test clue",
  correctResponse: "the answer",
};

const [rookie, casual, champion, legend] = baselineBotProfiles;

const famousAnswers = [
  "Mississippi",
  "George Washington",
  "Abraham Lincoln",
  "Mars",
  "The Beatles",
  "Leonardo da Vinci",
  "Shakespeare",
  "Mount Kilimanjaro",
  "Photosynthesis",
  "Tchaikovsky",
  "the War of 1812",
  "Henry VIII",
  "Paris",
  "12",
];

describe("bot decisions", () => {
  it("returns deterministic buzz delays for the same seed", () => {
    const decisionA = decideBotBuzz(champion, clue, createSeededRng(1234));
    const decisionB = decideBotBuzz(champion, clue, createSeededRng(1234));
    expect(decisionA).toEqual(decisionB);
  });

  it("higher difficulty buzzes more often and faster on average", () => {
    const rookieRng = createSeededRng(99);
    const legendRng = createSeededRng(99);
    const tally = { rookie: [0, 0], legend: [0, 0] };
    for (let i = 0; i < 500; i += 1) {
      const r = decideBotBuzz(rookie, clue, rookieRng);
      const l = decideBotBuzz(legend, clue, legendRng);
      if (r.shouldBuzz) tally.rookie = [tally.rookie[0] + r.buzzDelayMs, tally.rookie[1] + 1];
      if (l.shouldBuzz) tally.legend = [tally.legend[0] + l.buzzDelayMs, tally.legend[1] + 1];
    }
    expect(tally.legend[1]).toBeGreaterThan(tally.rookie[1]);
    expect(tally.legend[0] / tally.legend[1]).toBeLessThan(tally.rookie[0] / tally.rookie[1]);
  });

  it("never rings in faster than a person could see the buzzer open", () => {
    const rng = createSeededRng(5);
    for (let i = 0; i < 500; i += 1) {
      const decision = decideBotBuzz(legend, clue, rng);
      if (decision.shouldBuzz) expect(decision.buzzDelayMs).toBeGreaterThanOrEqual(350);
    }
  });

  it("keeps even the Legend beatable: under 100% right after ringing in", () => {
    for (const profile of baselineBotProfiles) {
      expect(correctWhenKnown(profile)).toBeLessThanOrEqual(0.95);
    }
    const rng = createSeededRng(3);
    let buzzed = 0;
    let right = 0;
    for (let i = 0; i < 2_000; i += 1) {
      const memory = new BotClueMemory(rng);
      const thisClue = { ...clue, id: `c${i}` };
      if (!memory.buzzFor("bot", legend, thisClue).shouldBuzz) continue;
      buzzed += 1;
      if (memory.answerFor("bot", legend, thisClue).answer === clue.correctResponse) right += 1;
    }
    expect(right / buzzed).toBeLessThan(0.96);
    expect(right / buzzed).toBeGreaterThan(0.8);
  });

  it("never answers blank after buzzing", () => {
    const rng = createSeededRng(11);
    for (let i = 0; i < 2_000; i += 1) {
      const decision = decideBotAnswer(rookie, clue, rng, { knowsAnswer: i % 2 === 0 });
      expect(decision.answer.trim()).not.toBe("");
      expect(decision.isAttempting).toBe(true);
    }
  });

  it("makes deliberately wrong answers that the judge rules wrong", () => {
    const rng = createSeededRng(7);
    for (const correct of famousAnswers) {
      for (let i = 0; i < 50; i += 1) {
        const wrong = makeWrongAnswer(correct, rng, famousAnswers);
        const verdict = judgeAnswer({ submittedAnswer: wrong, expectedAnswer: correct });
        expect(verdict.correct, `${wrong} for ${correct}`).toBe(false);
      }
    }
  });

  it("keeps a bot that doesn't know right only on lucky hunches", () => {
    const forcedWrong = { ...rookie, targetAccuracy: 0 };
    const rng = createSeededRng(11);
    let judgedCorrect = 0;
    for (let i = 0; i < 1_000; i += 1) {
      const expected = famousAnswers[i % famousAnswers.length];
      const decision = decideBotAnswer(
        forcedWrong,
        { ...clue, correctResponse: expected },
        rng,
        { knowsAnswer: false },
      );
      if (judgeAnswer({ submittedAnswer: decision.answer, expectedAnswer: expected }).correct) {
        judgedCorrect += 1;
      }
    }
    // Only hunches that happen to be right (25%) are right.
    expect(judgedCorrect / 1_000).toBeLessThan(0.32);
  });

  it("rolls knowledge once per clue, however often the room is re-read", () => {
    const trials = 2_000;
    let buzzedAfterManyReads = 0;
    let buzzedAfterOneRead = 0;
    for (let t = 0; t < trials; t += 1) {
      const memory = new BotClueMemory(createSeededRng(t + 1));
      let any = false;
      for (let evaluation = 0; evaluation < 7; evaluation += 1) {
        if (memory.buzzFor("bot", rookie, clue).shouldBuzz) any = true;
      }
      if (any) buzzedAfterManyReads += 1;
      if (new BotClueMemory(createSeededRng(t + 1)).buzzFor("bot", rookie, clue).shouldBuzz) {
        buzzedAfterOneRead += 1;
      }
    }
    expect(buzzedAfterManyReads).toBe(buzzedAfterOneRead);
    expect(buzzedAfterManyReads / trials).toBeLessThan(0.55);
  });

  it("forgets its decisions when the next clue comes up", () => {
    const memory = new BotClueMemory(createSeededRng(2));
    const first = memory.buzzFor("bot", casual, clue);
    expect(memory.buzzFor("bot", casual, clue)).toBe(first);
    const next = { ...clue, id: "c2", correctResponse: "Jupiter" };
    expect(memory.buzzFor("bot", casual, next)).not.toBe(first);
  });

  it("carries the buzz's knowledge into the answer", () => {
    const rng = createSeededRng(21);
    let knownButWrong = 0;
    let attempts = 0;
    for (let i = 0; i < 400; i += 1) {
      const memory = new BotClueMemory(rng);
      const thisClue = { ...clue, id: `k${i}` };
      const buzz = memory.buzzFor("bot", champion, thisClue);
      if (!buzz.shouldBuzz) continue;
      const answer = memory.answerFor("bot", champion, thisClue);
      expect(answer.knowsAnswer).toBe(buzz.knowsAnswer);
      if (buzz.knowsAnswer) {
        attempts += 1;
        if (answer.answer !== clue.correctResponse) knownButWrong += 1;
      }
    }
    expect(knownButWrong / attempts).toBeLessThan(0.15);
  });

  it("wagers within available score for daily double", () => {
    const amount = decideBotWager({
      profile: champion,
      clue,
      currentScore: 2_000,
      leaderScore: 2_000,
      round: "jeopardy",
      rng: createSeededRng(1),
    });
    expect(amount).toBeLessThanOrEqual(2_000);
    expect(amount).toBeGreaterThanOrEqual(5);
  });

  it("wagers zero for final-jeopardy when score is non-positive", () => {
    const amount = decideBotWager({
      profile: champion,
      clue: { ...clue, round: "final-jeopardy" },
      currentScore: 0,
      leaderScore: 5_000,
      round: "final-jeopardy",
      rng: createSeededRng(1),
    });
    expect(amount).toBe(0);
  });

  it("bets nothing in Final Jeopardy with the game locked", () => {
    for (const profile of baselineBotProfiles) {
      expect(decideFinalWager(profile, 20_000, 5_000)).toBe(0);
      expect(
        decideBotWager({
          profile,
          clue: { ...clue, round: "final-jeopardy" },
          currentScore: 20_000,
          leaderScore: 20_000,
          bestOpponentScore: 5_000,
          round: "final-jeopardy",
          rng: createSeededRng(1),
        }),
      ).toBe(0);
    }
  });

  it("covers a doubled second place when leading, without going all-in", () => {
    for (const profile of baselineBotProfiles) {
      const wager = decideFinalWager(profile, 10_000, 9_000);
      expect(10_000 + wager).toBeGreaterThan(18_000);
      expect(wager).toBeLessThan(10_000);
    }
  });

  it("bets enough to pass the leader when trailing", () => {
    for (const profile of baselineBotProfiles) {
      const wager = decideFinalWager(profile, 6_000, 10_000);
      expect(6_000 + wager).toBeGreaterThan(10_000);
      expect(wager).toBeLessThanOrEqual(6_000);
    }
  });
});
