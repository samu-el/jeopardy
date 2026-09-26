import { describe, expect, it } from "vitest";
import {
  describeVerdict,
  expandAlternatives,
  judgeAnswer,
  judgeWithReasoning,
  normalizeAnswer,
  setAmbiguousJudgeResolver,
  similarityScore,
} from "@/lib/ai";

/** [submitted, expected, what a human host would rule] */
type Case = [string, string, boolean];

// The 54 cases from the UX audit's judge probe (docs/ux-audit/ai.md).
const auditCases: Case[] = [
  ["the Beatles", "The Beatles", true],
  ["Beatles", "The Beatles", true],
  ["what are the beatles", "The Beatles", true],
  ["4", "four", true],
  ["four", "4", true],
  ["1812", "the War of 1812", true],
  ["war of 1812", "The War of 1812", true],
  ["Lincon", "Abraham Lincoln", true],
  ["lincoln", "Abraham Lincoln", true],
  ["Abe Lincoln", "Abraham Lincoln", true],
  ["Shakespear", "William Shakespeare", true],
  ["shakespeare", "William Shakespeare", true],
  ["what is mars", "Mars", true],
  ["What is Mars?", "Mars", true],
  ["whats mars", "Mars", true],
  ["Mars.", "Mars", true],
  ["who was lincoln", "Abraham Lincoln", true],
  ["what was the alamo", "the Alamo", true],
  ["St. Louis", "Saint Louis", true],
  ["Mt Everest", "Mount Everest", true],
  ["Dr. Seuss", "Dr. Seuss", true],
  ["Mississipi", "Mississippi", true],
  ["Missouri", "Mississippi", false],
  ["Austria", "Australia", false],
  ["Iran", "Iraq", false],
  ["Jupiter", "Saturn", false],
  ["George", "George Washington", false],
  ["Washington", "George Washington", true],
  ["George Bush", "George Washington", false],
  ["John Adams", "John Quincy Adams", false],
  ["John Quincy Adams", "John Adams", false],
  ["a", "Asia", false],
  ["e", "Beatles", false],
  ["on", "London", false],
  ["ton", "London", false],
  ["dog", "dogs", true],
  ["Canada", "Canada (accept: Dominion of Canada)", true],
  ["Mars (planet)", "Mars", true],
  ["Jean Valjean", "Valjean", true],
  ["M*A*S*H", "MASH", true],
  ["Café", "Cafe", true],
  ["Beyonce", "Beyoncé", true],
  ["Pokemon", "Pokémon", true],
  ["U.S.A.", "USA", true],
  ["rock 'n' roll", "rock and roll", true],
  ["don't know", "The Beatles", false],
  ["i dont know", "India", false],
  ["no", "Norway", false],
  ["Mary", "Mary I", false],
  ["Henry VIII", "Henry VII", false],
  ["Marsh", "Mars", false],
  ["Mares", "Mars", false],
  ["Mars", "Mars", true],
  ["1776", "1777", false],
  ["2", "12", false],
  ["12", "2", false],
  ["100", "1000", false],
];

const moreCases: Case[] = [
  // Prefixes
  ["who were the beatles", "The Beatles", true],
  ["Who's Ada Lovelace", "Ada Lovelace", true],
  ["what're mitochondria", "mitochondria", true],
  // Numbers, ordinals and regnal numerals
  ["Henry the Eighth", "Henry VIII", true],
  ["henry 8th", "Henry VIII", true],
  ["henry viii", "Henry VIII", true],
  ["Louis XIV", "Louis XV", false],
  ["World War One", "World War I", true],
  ["World War II", "World War I", false],
  ["twenty-one", "21", true],
  ["one hundred", "100", true],
  ["1,000", "1000", true],
  ["Mary I", "Mary I", true],
  ["Elizabeth II", "Elizabeth I", false],
  ["Super Bowl 50", "Super Bowl 51", false],
  ["Malcolm X", "Malcolm X", true],
  // Abbreviations and acronyms
  ["Saint Paul", "St. Paul", true],
  ["Mount Rushmore", "Mt. Rushmore", true],
  ["Fort Knox", "Ft. Knox", true],
  ["J.R.R. Tolkien", "JRR Tolkien", true],
  ["Tolkien", "J.R.R. Tolkien", true],
  ["USA", "United States", true],
  ["the U.K.", "United Kingdom", true],
  ["JFK", "John F. Kennedy", true],
  ["Vitamin A", "Vitamin A", true],
  ["Vitamin C", "Vitamin A", false],
  // Parentheticals and alternatives
  ["Big Apple", "New York City (or Big Apple)", true],
  ["Mars", "Mars (the planet)", true],
  ["the planet Mars", "Mars", true],
  ["Dominion of Canada", "Canada (accept: Dominion of Canada)", true],
  // Word-level matching, never substring
  ["Man", "Manchester", false],
  ["York", "New York", false],
  ["George Washington Carver", "George Washington", false],
  ["Harrison Ford", "Henry Ford", false],
  ["Spiderman", "Spider-Man", true],
  ["da Vinci", "Leonardo da Vinci", true],
  ["Tchaikovski", "Tchaikovsky", true],
  ["Tolstoy", "Dostoevsky", false],
  ["Niger", "Nigeria", false],
  ["Chile", "China", false],
];

describe("AI judge fuzzy matching", () => {
  it.each(auditCases)("audit: %j vs %j → %s", (submitted, expected, correct) => {
    expect(judgeAnswer({ submittedAnswer: submitted, expectedAnswer: expected }).correct).toBe(
      correct,
    );
  });

  it.each(moreCases)("%j vs %j → %s", (submitted, expected, correct) => {
    expect(judgeAnswer({ submittedAnswer: submitted, expectedAnswer: expected }).correct).toBe(
      correct,
    );
  });

  it("normalizes Jeopardy-style 'What is' prefixes and punctuation", () => {
    expect(normalizeAnswer("What is the moon?")).toBe("moon");
    expect(normalizeAnswer("Who is Ada Lovelace?")).toBe("ada lovelace");
    expect(normalizeAnswer("the United States")).toBe("united states");
    expect(normalizeAnswer("Who was Henry VIII?")).toBe("henry 8");
    expect(normalizeAnswer("U.S.A.")).toBe("united states");
    expect(normalizeAnswer("Crème brûlée")).toBe("creme brulee");
  });

  it("keeps a lone single letter instead of treating it as an article", () => {
    expect(normalizeAnswer("a")).toBe("a");
    expect(normalizeAnswer("Vitamin A")).toBe("vitamin a");
    expect(normalizeAnswer("A Tale of Two Cities")).toBe("tale of 2 cities");
  });

  it("expands optional parentheticals and archive alternatives", () => {
    expect(expandAlternatives("Canada (accept: Dominion of Canada)")).toEqual([
      "Canada",
      "Dominion of Canada",
    ]);
    expect(expandAlternatives("Mars (planet)")).toEqual(["Mars", "Mars planet"]);
    expect(expandAlternatives("Lincoln / Abe Lincoln")).toEqual(["Lincoln", "Abe Lincoln"]);
  });

  it("accepts exact matches and minor spelling differences", () => {
    expect(judgeAnswer({ submittedAnswer: "Mars", expectedAnswer: "Mars" }).correct).toBe(true);
    expect(
      judgeAnswer({ submittedAnswer: "Ada Lovelass", expectedAnswer: "Ada Lovelace" }).correct,
    ).toBe(true);
  });

  it("is confident about clearly wrong answers, not just clearly right ones", () => {
    const verdict = judgeAnswer({ submittedAnswer: "Saturn", expectedAnswer: "Jupiter" });
    expect(verdict.correct).toBe(false);
    expect(verdict.score).toBeLessThan(0.3);
    expect(verdict.confidence).toBeGreaterThan(0.9);
    expect(verdict.label).toBe("likely-wrong");
    expect(describeVerdict(verdict)).toBe("Likely wrong");

    const exact = judgeAnswer({ submittedAnswer: "Jupiter", expectedAnswer: "Jupiter" });
    expect(exact.confidence).toBe(1);
    expect(exact.label).toBe("likely-correct");
  });

  it("flags near-misses as ambiguous", () => {
    const typo = judgeAnswer({ submittedAnswer: "Lincon", expectedAnswer: "Abraham Lincoln" });
    expect(typo.correct).toBe(true);
    expect(typo.ambiguous).toBe(true);
    expect(typo.label).toBe("unsure");

    const middle = judgeAnswer({
      submittedAnswer: "John Adams",
      expectedAnswer: "John Quincy Adams",
    });
    expect(middle.correct).toBe(false);
    expect(middle.ambiguous).toBe(true);

    for (const [submitted, expected] of [
      ["Jupiter", "Saturn"],
      ["2", "12"],
      ["Mars", "Mars"],
    ]) {
      expect(
        judgeAnswer({ submittedAnswer: submitted, expectedAnswer: expected }).ambiguous,
      ).toBe(false);
    }
  });

  it("rejects empty answers with full confidence", () => {
    const verdict = judgeAnswer({ submittedAnswer: "  ", expectedAnswer: "anything" });
    expect(verdict.correct).toBe(false);
    expect(verdict.confidence).toBe(1);
  });

  it("considers alternative accepted answers and reports which one matched", () => {
    const verdict = judgeAnswer({
      submittedAnswer: "America",
      expectedAnswer: "United States",
      acceptAlternatives: ["the USA", "America"],
    });
    expect(verdict.correct).toBe(true);
    expect(verdict.matchedAlternative).toBe("America");
  });

  it("escalates only ambiguous verdicts to the optional resolver", async () => {
    const calls: string[] = [];
    setAmbiguousJudgeResolver(async (input) => {
      calls.push(input.submittedAnswer);
      return { ...input.fuzzyVerdict, correct: false, reason: "resolver" };
    });
    try {
      const clear = await judgeWithReasoning({ submittedAnswer: "Mars", expectedAnswer: "Mars" });
      expect(clear.correct).toBe(true);
      const unsure = await judgeWithReasoning({
        submittedAnswer: "Lincon",
        expectedAnswer: "Abraham Lincoln",
      });
      expect(unsure.reason).toBe("resolver");
      expect(calls).toEqual(["Lincon"]);
    } finally {
      setAmbiguousJudgeResolver(async () => null);
    }
  });

  it("reports near-1 similarity for identical strings", () => {
    expect(similarityScore("hello", "hello")).toBe(1);
    expect(similarityScore("", "hello")).toBe(0);
  });
});
