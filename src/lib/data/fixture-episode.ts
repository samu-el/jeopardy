import type { ArchivedEpisodeInput } from "./contracts";

/**
 * Tiny self-contained board served when NODE_ENV === "test" or ?fixture=1
 * is set, so tests don't depend on the live archive download. Original
 * clues, not pulled from any source.
 */
export const fixtureEpisode: ArchivedEpisodeInput = {
  epNum: "0",
  airDate: "2026-01-01",
  info: "fixture",
  title: "Fixture board",
  jeopardy: [
    { x: 1, y: 1, cat: "Math", val: 200, q: "Two plus two.", a: "four" },
    { x: 1, y: 2, cat: "Math", val: 400, q: "Pi to two places.", a: "3.14" },
    { x: 2, y: 1, cat: "Colors", val: 200, q: "Mix red and blue.", a: "purple" },
    { x: 2, y: 2, cat: "Colors", val: 400, q: "Color of an emerald.", a: "green" },
  ],
  final: [
    {
      cat: "Programming",
      q: "Language whose mascot is a gopher.",
      a: "Go",
    },
  ],
};
