export interface JudgeVerdict {
  correct: boolean;
  confidence: number;
  normalizedAnswer: string;
  normalizedExpected: string;
  reason: string;
}

export interface JudgeInput {
  submittedAnswer: string;
  expectedAnswer: string;
  acceptAlternatives?: string[];
}

const stopPrefixes = [
  "what is ",
  "what are ",
  "who is ",
  "who are ",
  "where is ",
  "where are ",
  "when is ",
  "when are ",
  "why is ",
  "why are ",
  "how is ",
  "how are ",
  "what's ",
  "who's ",
  "where's ",
];

const removableWords = new Set(["the", "a", "an", "and"]);

export function normalizeAnswer(input: string): string {
  let value = input.toLowerCase().trim();
  for (const prefix of stopPrefixes) {
    if (value.startsWith(prefix)) {
      value = value.slice(prefix.length);
      break;
    }
  }
  value = value
    .replace(/[?.!,;:'"`()[\]{}]/g, " ")
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ")
    .trim();

  return value
    .split(" ")
    .filter((word) => word && !removableWords.has(word))
    .join(" ");
}

export function similarityScore(a: string, b: string): number {
  if (!a || !b) {
    return 0;
  }
  if (a === b) {
    return 1;
  }
  const distance = levenshtein(a, b);
  const maxLength = Math.max(a.length, b.length);
  return Math.max(0, 1 - distance / maxLength);
}

function levenshtein(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[rows - 1][cols - 1];
}

export function judgeAnswer(input: JudgeInput): JudgeVerdict {
  const normalizedExpected = normalizeAnswer(input.expectedAnswer);
  const normalizedAnswer = normalizeAnswer(input.submittedAnswer);

  if (!normalizedAnswer) {
    return {
      correct: false,
      confidence: 1,
      normalizedAnswer,
      normalizedExpected,
      reason: "no answer was submitted",
    };
  }

  const candidates = [normalizedExpected, ...(input.acceptAlternatives ?? []).map(normalizeAnswer)]
    .filter(Boolean);

  let bestScore = 0;
  let bestCandidate = candidates[0] ?? "";
  for (const candidate of candidates) {
    const score = similarityScore(normalizedAnswer, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
    if (candidate && (normalizedAnswer.includes(candidate) || candidate.includes(normalizedAnswer))) {
      const overlap = Math.min(normalizedAnswer.length, candidate.length) /
        Math.max(normalizedAnswer.length, candidate.length);
      const inclusionScore = 0.65 + overlap * 0.35;
      if (inclusionScore > bestScore) {
        bestScore = inclusionScore;
        bestCandidate = candidate;
      }
    }
  }

  const correct = bestScore >= 0.78;
  return {
    correct,
    confidence: Number(bestScore.toFixed(3)),
    normalizedAnswer,
    normalizedExpected: bestCandidate,
    reason: correct
      ? `matched "${bestCandidate}" with score ${bestScore.toFixed(2)}`
      : `closest "${bestCandidate}" only scored ${bestScore.toFixed(2)}`,
  };
}
