import { describe, expect, it } from "vitest";
import { judgeAnswer, normalizeAnswer, similarityScore } from "@/lib/ai";

describe("AI judge fuzzy matching", () => {
  it("normalizes Jeopardy-style 'What is' prefixes and punctuation", () => {
    expect(normalizeAnswer("What is the moon?")).toBe("moon");
    expect(normalizeAnswer("Who is Ada Lovelace?")).toBe("ada lovelace");
    expect(normalizeAnswer("the United States")).toBe("united states");
  });

  it("accepts exact matches and minor spelling differences", () => {
    expect(
      judgeAnswer({ submittedAnswer: "Mars", expectedAnswer: "Mars" }).correct,
    ).toBe(true);
    expect(
      judgeAnswer({ submittedAnswer: "What is Mars?", expectedAnswer: "Mars" }).correct,
    ).toBe(true);
    expect(
      judgeAnswer({
        submittedAnswer: "Ada Lovelass",
        expectedAnswer: "Ada Lovelace",
      }).correct,
    ).toBe(true);
  });

  it("rejects unrelated answers with low confidence", () => {
    const verdict = judgeAnswer({
      submittedAnswer: "Saturn",
      expectedAnswer: "Jupiter",
    });
    expect(verdict.correct).toBe(false);
    expect(verdict.confidence).toBeLessThan(0.78);
  });

  it("rejects empty answers", () => {
    expect(
      judgeAnswer({ submittedAnswer: "  ", expectedAnswer: "anything" }).correct,
    ).toBe(false);
  });

  it("considers alternative accepted answers", () => {
    const verdict = judgeAnswer({
      submittedAnswer: "America",
      expectedAnswer: "United States",
      acceptAlternatives: ["the USA", "America"],
    });
    expect(verdict.correct).toBe(true);
  });

  it("reports near-1 similarity for identical strings", () => {
    expect(similarityScore("hello", "hello")).toBe(1);
    expect(similarityScore("", "hello")).toBe(0);
  });
});
