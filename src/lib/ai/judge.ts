/**
 * The fuzzy judge: rules a typed answer against a clue's correct response.
 *
 * It works on whole words, never on character substrings — "on" is not
 * "London" and "2" is not "12". Numbers (digits, number words, ordinals and
 * regnal numerals) have to agree exactly, because Jeopardy answers hinge on
 * them: Henry VIII is not Henry VII, and Mary is not Mary I.
 *
 * Everything else a human host would wave through is folded away before the
 * comparison: "What is / who was" prefixes, articles, diacritics, St./Saint,
 * Mt/Mount, U.S.A./USA, number words, optional parentheticals and
 * archive-style "(accept: …)" alternatives, small typos in long words, and a
 * bare surname.
 */

export type JudgeVerdictLabel = "likely-correct" | "unsure" | "likely-wrong";

export interface JudgeVerdict {
  correct: boolean;
  /**
   * How sure the judge is of its own ruling, from 0.5 (a coin flip) to 1.
   * A clearly wrong answer is ruled wrong with high confidence.
   */
  confidence: number;
  /** How closely the answer matched the best alternative, from 0 to 1. */
  score: number;
  /** True for near-misses a human host should look at before ruling. */
  ambiguous: boolean;
  label: JudgeVerdictLabel;
  /** The accepted response (as written) that the answer came closest to. */
  matchedAlternative: string;
  normalizedAnswer: string;
  normalizedExpected: string;
  reason: string;
}

export interface JudgeInput {
  submittedAnswer: string;
  expectedAnswer: string;
  acceptAlternatives?: string[];
}

/** Scores at or above this are ruled correct. */
export const judgeAcceptThreshold = 0.8;
/** Scores in [low, high) are flagged as ambiguous for the host. */
export const judgeAmbiguousBand = { low: 0.6, high: 0.85 } as const;

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

const questionPrefix =
  /^(?:who|what|where|when|which|why|how)(?:\s+|'|’)?(?:is|are|was|were|s|re|am)\s+/;

const abbreviations: Record<string, string> = {
  st: "saint",
  ste: "sainte",
  mt: "mount",
  mtn: "mountain",
  ft: "fort",
  dr: "doctor",
  mr: "mister",
  mrs: "missus",
  jr: "junior",
  sr: "senior",
  vs: "versus",
  pres: "president",
  gen: "general",
  capt: "captain",
};

/** Whole-answer aliases, applied after everything else is normalised. */
const phraseAliases: Record<string, string> = {
  usa: "united states",
  us: "united states",
  "united states of america": "united states",
  uk: "united kingdom",
  ussr: "soviet union",
  "union of soviet socialist republics": "soviet union",
};

const units: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const tens: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const scales: Record<string, number> = {
  hundred: 100,
  thousand: 1_000,
  million: 1_000_000,
  billion: 1_000_000_000,
};
const ordinals: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  thirtieth: 30,
  fortieth: 40,
  fiftieth: 50,
  hundredth: 100,
  thousandth: 1_000,
};

const stopWords = new Set([
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "de",
  "la",
  "le",
  "el",
  "von",
  "van",
  "der",
  "da",
  "du",
  "del",
  "di",
]);

/** Extra words an answer may carry without changing what it names. */
const descriptorWords = new Set([
  "planet",
  "mount",
  "mountain",
  "lake",
  "river",
  "city",
  "state",
  "country",
  "king",
  "queen",
  "president",
  "saint",
  "sir",
  "doctor",
  "sea",
  "ocean",
  "island",
  "islands",
  "desert",
  "empire",
  "kingdom",
  "province",
  "county",
  "general",
  "mister",
  "miss",
  "missus",
  "captain",
  "lord",
  "lady",
  "prince",
  "princess",
  "emperor",
  "pope",
  "band",
  "group",
  "film",
  "movie",
  "novel",
  "book",
  "song",
  "play",
  "opera",
  "musical",
]);

/** Common short forms of given names. */
const nicknames: Record<string, string[]> = {
  abe: ["abraham"],
  al: ["albert", "alfred", "alexander"],
  alex: ["alexander"],
  ben: ["benjamin"],
  bill: ["william"],
  billy: ["william"],
  bob: ["robert"],
  chuck: ["charles"],
  dan: ["daniel"],
  dick: ["richard"],
  ed: ["edward", "edwin"],
  fred: ["frederick"],
  jack: ["john"],
  jim: ["james"],
  jimmy: ["james"],
  joe: ["joseph"],
  liz: ["elizabeth"],
  mike: ["michael"],
  nick: ["nicholas"],
  pete: ["peter"],
  rob: ["robert"],
  ron: ["ronald"],
  sam: ["samuel"],
  ted: ["edward", "theodore"],
  teddy: ["theodore"],
  tom: ["thomas"],
  will: ["william"],
};

/**
 * Words that are part of a name, not a description of it: "York" is not
 * "New York", and "Louis" is not "Saint Louis".
 */
const bindingPrefixes = new Set([
  "new",
  "san",
  "santa",
  "saint",
  "sainte",
  "los",
  "las",
  "port",
  "fort",
  "north",
  "south",
  "east",
  "west",
  "upper",
  "lower",
  "great",
  "little",
  "costa",
  "puerto",
  "sri",
]);

function isNumberToken(token: string) {
  return /^\d+$/.test(token);
}

/** I–XXXIX only: wider numerals collide with DC, MD, CD, LCD and friends. */
function romanValue(token: string): number | undefined {
  if (!/^[ivx]{1,6}$/.test(token)) return undefined;
  const values: Record<string, number> = { i: 1, v: 5, x: 10 };
  let total = 0;
  for (let index = 0; index < token.length; index += 1) {
    const current = values[token[index]];
    const next = values[token[index + 1]] ?? 0;
    total += current < next ? -current : current;
  }
  // Reject non-canonical spellings ("iiii", "vx", "iix").
  return toRoman(total) === token ? total : undefined;
}

function toRoman(value: number): string {
  const table: [number, string][] = [
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"],
  ];
  let rest = value;
  let out = "";
  for (const [amount, glyph] of table) {
    while (rest >= amount) {
      out += glyph;
      rest -= amount;
    }
  }
  return out;
}

/** Folds runs of number words ("twenty one", "one hundred five") into digits. */
function foldNumberWords(tokens: string[]): string[] {
  const out: string[] = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (ordinals[token] !== undefined) {
      out.push(String(ordinals[token]));
      index += 1;
      continue;
    }
    if (units[token] === undefined && tens[token] === undefined) {
      out.push(token);
      index += 1;
      continue;
    }
    let total = 0;
    let current = 0;
    let consumed = 0;
    while (index + consumed < tokens.length) {
      const word = tokens[index + consumed];
      if (units[word] !== undefined) current += units[word];
      else if (tens[word] !== undefined) current += tens[word];
      else if (scales[word] !== undefined && consumed > 0) {
        if (scales[word] === 100) current *= 100;
        else {
          total += current * scales[word];
          current = 0;
        }
      } else if (ordinals[word] !== undefined && consumed > 0) {
        current = ordinals[word] >= 100 ? current * ordinals[word] : current + ordinals[word];
        consumed += 1;
        break;
      } else break;
      consumed += 1;
    }
    out.push(String(total + current));
    index += consumed;
  }
  return out;
}

/** Joins runs of two or more single letters: "u s a" → "usa". */
function collapseLetterRuns(tokens: string[]): string[] {
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 2) out.push(run.join(""));
    else out.push(...run);
    run = [];
  };
  for (const token of tokens) {
    if (/^[a-z]$/.test(token)) run.push(token);
    else {
      flush();
      out.push(token);
    }
  }
  flush();
  return out;
}

/** The comparable words of one string. Pure; exported for tests. */
export function tokenizeAnswer(input: string): string[] {
  let value = input
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .trim();
  value = value.replace(questionPrefix, "");
  value = value
    // Acronyms before dots become spaces: "u.s.a." → "usa".
    .replace(/\b(?:[a-z]\.){2,}/g, (match) => match.replace(/\./g, ""))
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/&/g, " and ")
    .replace(/['’`*]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!value) return [];

  let tokens = value.split(" ").filter(Boolean);
  tokens = collapseLetterRuns(tokens);
  tokens = tokens.map((token, index) => {
    const ordinal = /^(\d+)(?:st|nd|rd|th)$/.exec(token);
    if (ordinal) return ordinal[1];
    if (token === "n" && index > 0 && index < tokens.length - 1) return "and";
    return abbreviations[token] ?? token;
  });
  tokens = foldNumberWords(tokens);
  tokens = tokens.map((token, index) => {
    if (index === 0) return token;
    const roman = romanValue(token);
    return roman === undefined ? token : String(roman);
  });
  if (tokens.length > 1) {
    tokens = tokens.filter((token) => token !== "and" && token !== "the");
    if (tokens.length > 1 && (tokens[0] === "a" || tokens[0] === "an")) tokens = tokens.slice(1);
  }
  if (tokens.length === 0) return [];
  const alias = phraseAliases[tokens.join(" ")];
  return alias ? alias.split(" ") : tokens;
}

export function normalizeAnswer(input: string): string {
  return tokenizeAnswer(input).join(" ");
}

/**
 * The accepted spellings of one response. Parenthesised words are optional
 * ("Mars (planet)"), and archive notes such as "(accept: Dominion of Canada)"
 * or "[or Big Apple]" become alternatives of their own.
 */
export function expandAlternatives(text: string): string[] {
  const variants = new Set<string>();
  const alternatives: string[] = [];
  const bracket = /\s*[([]([^)\]]*)[)\]]\s*/g;
  const optional: string[] = [];
  const base = text
    .replace(bracket, (_match, inner: string) => {
      const note = /^\s*(?:also\s+accept|accept|or|also|alternate(?:ly)?|a\.?k\.?a\.?)\b[:\s]*/i.exec(
        inner,
      );
      if (note) {
        alternatives.push(
          ...inner
            .slice(note[0].length)
            .split(/[,;]|\s+or\s+/i)
            .map((part) => part.trim())
            .filter(Boolean),
        );
      } else {
        optional.push(inner);
      }
      return " ";
    })
    .trim();
  for (const part of base.split(/\s+\/\s+/)) {
    if (part.trim()) variants.add(part.trim());
  }
  if (optional.length > 0) {
    // With the optional words spelled out as well as without them.
    variants.add(text.replace(/[()[\]]/g, " ").replace(/\s+/g, " ").trim());
  }
  for (const alternative of alternatives) variants.add(alternative);
  if (variants.size === 0 && text.trim()) variants.add(text.trim());
  return [...variants];
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** Optimal string alignment distance: Levenshtein plus adjacent swaps. */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) d[i][0] = i;
  for (let j = 0; j < cols; j += 1) d[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[rows - 1][cols - 1];
}

export function similarityScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  return Math.max(0, 1 - editDistance(a, b) / Math.max(a.length, b.length));
}

/** How many typos a word of this length may carry and still count. */
function allowedEdits(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  const lengthGap = Math.abs(a.length - b.length);
  // Judged on the shorter word: one letter added to "Mars" is "Marsh", a
  // different word, not a typo.
  if (Math.min(a.length, b.length) <= 4) return 0;
  if (longest >= 8 && lengthGap < 2) return 2;
  return 1;
}

interface TokenMatch {
  quality: number;
  nickname: boolean;
}

function matchToken(answer: string, expected: string): TokenMatch {
  if (answer === expected) return { quality: 1, nickname: false };
  if (isNumberToken(answer) || isNumberToken(expected)) return { quality: 0, nickname: false };
  if (
    answer + "s" === expected ||
    expected + "s" === answer ||
    answer + "es" === expected ||
    expected + "es" === answer
  ) {
    return { quality: 0.95, nickname: false };
  }
  const distance = editDistance(answer, expected);
  if (distance <= allowedEdits(answer, expected)) {
    return {
      quality: 1 - distance / Math.max(answer.length, expected.length),
      nickname: false,
    };
  }
  // "Abe" for "Abraham": a short form of a given name, never of the key word.
  if (nicknames[answer]?.includes(expected)) return { quality: 0.7, nickname: true };
  if (answer.length >= 3 && expected.length >= answer.length + 2 && expected.startsWith(answer)) {
    return { quality: 0.7, nickname: true };
  }
  return { quality: 0, nickname: false };
}

function weightOf(token: string) {
  if (stopWords.has(token)) return 0.5;
  if (isNumberToken(token)) return Math.max(3, token.length);
  return token.length;
}

interface TokenScore {
  score: number;
  reason: string;
}

function sameNumbers(a: string[], b: string[]) {
  const left = a.filter(isNumberToken).sort();
  const right = b.filter(isNumberToken).sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function scoreTokens(answer: string[], expected: string[]): TokenScore {
  if (answer.length === 0 || expected.length === 0) return { score: 0, reason: "nothing to compare" };
  if (answer.join(" ") === expected.join(" ")) return { score: 1, reason: "exact match" };
  if (!sameNumbers(answer, expected)) {
    return { score: 0.1, reason: "the numbers differ" };
  }
  if (answer.join("") === expected.join("")) return { score: 0.98, reason: "same letters, different spacing" };

  // Initials: "JFK" for "John F Kennedy".
  const contentExpected = expected.filter((token) => !stopWords.has(token));
  if (
    answer.length === 1 &&
    contentExpected.length >= 2 &&
    answer[0].length === contentExpected.length &&
    contentExpected.map((token) => token[0]).join("") === answer[0]
  ) {
    return { score: 0.8, reason: "initials of the response" };
  }

  // Greedy best-first alignment of answer words to expected words.
  const pairs: { i: number; j: number; match: TokenMatch }[] = [];
  answer.forEach((a, i) =>
    expected.forEach((e, j) => {
      const match = matchToken(a, e);
      if (match.quality > 0) pairs.push({ i, j, match });
    }),
  );
  pairs.sort((x, y) => y.match.quality - x.match.quality || Math.abs(x.i - x.j) - Math.abs(y.i - y.j));
  const answerUsed = new Map<number, number>();
  const expectedMatch = new Map<number, TokenMatch>();
  for (const pair of pairs) {
    if (answerUsed.has(pair.i) || expectedMatch.has(pair.j)) continue;
    answerUsed.set(pair.i, pair.j);
    expectedMatch.set(pair.j, pair.match);
  }

  let keyIndex = expected.length - 1;
  while (keyIndex > 0 && stopWords.has(expected[keyIndex])) keyIndex -= 1;
  const key = expectedMatch.get(keyIndex);
  if (key?.nickname) expectedMatch.delete(keyIndex);

  let totalWeight = 0;
  let matchedWeight = 0;
  let qualityWeight = 0;
  expected.forEach((token, j) => {
    const weight = weightOf(token);
    totalWeight += weight;
    const match = expectedMatch.get(j);
    if (match) {
      matchedWeight += weight;
      qualityWeight += weight * match.quality;
    }
  });
  const coverage = totalWeight === 0 ? 0 : matchedWeight / totalWeight;
  const quality = matchedWeight === 0 ? 0 : qualityWeight / matchedWeight;

  if (!expectedMatch.has(keyIndex)) {
    return {
      score: 0.45 * coverage * quality,
      reason: `the key word "${expected[keyIndex]}" is missing`,
    };
  }

  let score = 0.6 + 0.4 * quality;
  let reason = quality === 1 ? "every word matches" : "matches allowing a typo";
  if (coverage < 1) {
    score *= 0.78 + 0.22 * coverage;
    reason = `partial match on "${expected[keyIndex]}"`;
  }

  // A gap in the middle ("John Adams" for "John Quincy Adams") names someone else.
  const matchedIndices = [...expectedMatch.keys()].sort((a, b) => a - b);
  const first = matchedIndices[0];
  const last = matchedIndices[matchedIndices.length - 1];
  const middleGap = expected.some(
    (token, j) => j > first && j < last && !expectedMatch.has(j) && !stopWords.has(token),
  );
  if (middleGap) {
    score *= 0.7;
    reason = "a word in the middle is missing";
  }

  if (expected.some((token, j) => j < first && bindingPrefixes.has(token))) {
    score *= 0.85;
    reason = "part of the name is missing";
  }

  // Words the answer adds that the response doesn't have.
  const firstMatchedAnswer = Math.min(...answerUsed.keys());
  const expectedHasLeadingGap = expected.some(
    (token, j) => j < first && !stopWords.has(token),
  );
  const unmatchedExpected = expected.some(
    (token, j) => !expectedMatch.has(j) && !stopWords.has(token),
  );
  answer.forEach((token, i) => {
    if (answerUsed.has(i) || stopWords.has(token)) return;
    if (descriptorWords.has(token)) {
      score *= 0.97;
      return;
    }
    if (i < firstMatchedAnswer && !expectedHasLeadingGap) {
      // A given name in front of the surname: "Jean Valjean" for "Valjean".
      score *= 0.95;
      return;
    }
    score *= 0.7;
    reason = unmatchedExpected ? "a word was swapped for another" : `"${token}" is extra`;
  });

  return { score, reason };
}

function verdictConfidence(score: number, correct: boolean) {
  const t = judgeAcceptThreshold;
  const distance = correct ? (score - t) / (1 - t) : (t - score) / t;
  return 0.5 + 0.5 * Math.max(0, Math.min(1, distance));
}

function round3(value: number) {
  return Number(value.toFixed(3));
}

export function judgeAnswer(input: JudgeInput): JudgeVerdict {
  const alternatives = [
    ...expandAlternatives(input.expectedAnswer),
    ...(input.acceptAlternatives ?? []).flatMap(expandAlternatives),
  ];
  const primaryExpected = normalizeAnswer(alternatives[0] ?? input.expectedAnswer);
  const answerVariants = expandAlternatives(input.submittedAnswer)
    .map(tokenizeAnswer)
    .filter((tokens) => tokens.length > 0);

  if (answerVariants.length === 0) {
    return {
      correct: false,
      confidence: 1,
      score: 0,
      ambiguous: false,
      label: "likely-wrong",
      matchedAlternative: alternatives[0] ?? input.expectedAnswer,
      normalizedAnswer: "",
      normalizedExpected: primaryExpected,
      reason: "no answer was submitted",
    };
  }

  let best = {
    score: -1,
    reason: "",
    alternative: alternatives[0] ?? input.expectedAnswer,
    answer: answerVariants[0],
    expected: tokenizeAnswer(alternatives[0] ?? input.expectedAnswer),
  };
  for (const alternative of alternatives) {
    const expected = tokenizeAnswer(alternative);
    if (expected.length === 0) continue;
    for (const answer of answerVariants) {
      const result = scoreTokens(answer, expected);
      if (result.score > best.score) {
        best = { score: result.score, reason: result.reason, alternative, answer, expected };
      }
    }
  }

  const score = Math.max(0, Math.min(1, best.score));
  const correct = score >= judgeAcceptThreshold;
  const ambiguous = score >= judgeAmbiguousBand.low && score < judgeAmbiguousBand.high;
  const normalizedExpected = best.expected.join(" ");
  return {
    correct,
    confidence: round3(verdictConfidence(score, correct)),
    score: round3(score),
    ambiguous,
    label: ambiguous ? "unsure" : correct ? "likely-correct" : "likely-wrong",
    matchedAlternative: best.alternative,
    normalizedAnswer: best.answer.join(" "),
    normalizedExpected,
    reason: `${correct ? "accepted" : "rejected"} against "${normalizedExpected}": ${best.reason} (${score.toFixed(2)})`,
  };
}

/** Human wording for a verdict, for the host's bench or the clue stage. */
export function describeVerdict(verdict: JudgeVerdict): string {
  switch (verdict.label) {
    case "likely-correct":
      return "Likely correct";
    case "unsure":
      return verdict.correct ? "Unsure — leaning correct" : "Unsure — leaning wrong";
    case "likely-wrong":
      return "Likely wrong";
  }
}

// ---------------------------------------------------------------------------
// Escalation hook
// ---------------------------------------------------------------------------

export interface AmbiguousJudgeInput extends JudgeInput {
  fuzzyVerdict: JudgeVerdict;
}

/**
 * Hook for an env-gated higher-quality judge (e.g. an LLM tool call) when
 * the fuzzy verdict is ambiguous. Default implementation returns null — the
 * caller falls back to the fuzzy verdict, keeping the app free-forever.
 */
export type AmbiguousJudgeResolver = (
  input: AmbiguousJudgeInput,
) => Promise<JudgeVerdict | null>;

let resolver: AmbiguousJudgeResolver = async () => null;

export function setAmbiguousJudgeResolver(next: AmbiguousJudgeResolver) {
  resolver = next;
}

export async function judgeWithReasoning(input: JudgeInput): Promise<JudgeVerdict> {
  const fuzzy = judgeAnswer(input);
  // Only escalate when the fuzzy verdict is on the fence.
  if (fuzzy.ambiguous) {
    try {
      const upgraded = await resolver({ ...input, fuzzyVerdict: fuzzy });
      if (upgraded) return upgraded;
    } catch {
      // ignore — fall through to fuzzy
    }
  }
  return fuzzy;
}
