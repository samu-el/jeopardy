import Papa from "papaparse";
import type { GameClue, PlayableRound } from "@/lib/game";
import {
  type ArchivedEpisodeInput,
  type ArchivedRawClue,
  type CustomCsvRow,
  type GameDataIssue,
  type GameDataNormalizationResult,
  type NormalizationOptions,
  type NormalizedGame,
  type RoundDefinition,
} from "./contracts";

const roundDefinitions: RoundDefinition[] = [
  { rawName: "jeopardy", round: "jeopardy", valueMultiplier: 1 },
  { rawName: "double", round: "double-jeopardy", valueMultiplier: 2 },
  { rawName: "triple", round: "triple-jeopardy", valueMultiplier: 3 },
  { rawName: "final", round: "final-jeopardy", valueMultiplier: 0 },
];

const roundAliases = new Map<string, PlayableRound>([
  ["j", "jeopardy"],
  ["single", "jeopardy"],
  ["jeopardy", "jeopardy"],
  ["double", "double-jeopardy"],
  ["doublejeopardy", "double-jeopardy"],
  ["double-jeopardy", "double-jeopardy"],
  ["dj", "double-jeopardy"],
  ["triple", "triple-jeopardy"],
  ["triplejeopardy", "triple-jeopardy"],
  ["triple-jeopardy", "triple-jeopardy"],
  ["tj", "triple-jeopardy"],
  ["final", "final-jeopardy"],
  ["finaljeopardy", "final-jeopardy"],
  ["final-jeopardy", "final-jeopardy"],
  ["fj", "final-jeopardy"],
]);

export function normalizeArchivedEpisode(
  input: ArchivedEpisodeInput,
  options: NormalizationOptions = {},
): GameDataNormalizationResult {
  const issues: GameDataIssue[] = [];
  const episodeNumber = input.episodeNumber ?? input.epNum;
  const id = options.id ?? stableId(["episode", episodeNumber, input.airDate, input.info]);
  const title =
    options.title ??
    input.title ??
    [episodeNumber ? `Episode ${episodeNumber}` : undefined, input.airDate]
      .filter(Boolean)
      .join(" - ") ??
    "Archived Jeopardy game";

  const clues = roundDefinitions.flatMap((definition) =>
    normalizeArchivedRound(input, definition, issues),
  );

  return finalizeGame({
    id,
    source: "archived-episode",
    title: title || "Archived Jeopardy game",
    metadata: {
      episodeNumber,
      airDate: input.airDate,
      title: input.title,
      notes: input.info,
    },
    clues,
    issues,
  });
}

export function normalizeCustomCsvGame(
  csvText: string,
  options: NormalizationOptions = {},
): GameDataNormalizationResult {
  const issues: GameDataIssue[] = [];
  if (!csvText.trim()) {
    return {
      ok: false,
      issues: [
        {
          severity: "error",
          code: "empty-input",
          message: "Custom game CSV is empty.",
        },
      ],
    };
  }

  const parse = Papa.parse<CustomCsvRow>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  for (const error of parse.errors) {
    issues.push({
      severity: "error",
      code: "csv-parse-error",
      message: error.message,
      row: error.row == null ? undefined : error.row + 1,
    });
  }

  const categoryPositions = new Map<string, number>();
  const clues = parse.data.flatMap((row, index) => {
    const rowNumber = index + 2;
    return normalizeCustomCsvRow(row, rowNumber, categoryPositions, issues);
  });

  return finalizeGame({
    id: options.id ?? stableId(["custom-csv", csvText]),
    source: "custom-csv",
    title: options.title ?? "Custom Jeopardy game",
    metadata: {
      title: options.title,
    },
    clues,
    issues,
  });
}

function normalizeArchivedRound(
  input: ArchivedEpisodeInput,
  definition: RoundDefinition,
  issues: GameDataIssue[],
): GameClue[] {
  const rawClues = input[definition.rawName as keyof ArchivedEpisodeInput];
  if (!Array.isArray(rawClues) || rawClues.length === 0) {
    issues.push({
      severity: "warning",
      code: "empty-round",
      message: `No clues found for ${definition.round}.`,
      field: definition.rawName,
    });
    return [];
  }

  return rawClues.flatMap((raw, index) =>
    normalizeRawClue({
      raw,
      row: index + 1,
      idPrefix: definition.round,
      fallbackRound: definition.round,
      fallbackValue: inferValue(definition.round, raw, index, definition.valueMultiplier),
      issues,
    }),
  );
}

function normalizeCustomCsvRow(
  row: CustomCsvRow,
  rowNumber: number,
  categoryPositions: Map<string, number>,
  issues: GameDataIssue[],
): GameClue[] {
  const round = normalizeRound(row.round);
  if (!round) {
    issues.push({
      severity: "error",
      code: row.round ? "invalid-round" : "missing-field",
      message: row.round
        ? `Unsupported round "${row.round}" on row ${rowNumber}.`
        : `Missing round on row ${rowNumber}.`,
      row: rowNumber,
      field: "round",
    });
    return [];
  }

  const category = clean(row.category ?? row.cat);
  const positionKey = `${round}:${category || "uncategorized"}`;
  const nextPosition = (categoryPositions.get(positionKey) ?? 0) + 1;
  categoryPositions.set(positionKey, nextPosition);

  return normalizeRawClue({
    raw: row,
    row: rowNumber,
    idPrefix: `${round}-${categorySlug(category)}-${nextPosition}`,
    fallbackRound: round,
    fallbackValue: inferValue(round, row, nextPosition - 1, multiplierFor(round)),
    issues,
  });
}

function normalizeRawClue({
  raw,
  row,
  idPrefix,
  fallbackRound,
  fallbackValue,
  issues,
}: {
  raw: ArchivedRawClue | CustomCsvRow;
  row: number;
  idPrefix: string;
  fallbackRound: PlayableRound;
  fallbackValue: number;
  issues: GameDataIssue[];
}): GameClue[] {
  const round = "round" in raw ? normalizeRound(raw.round) ?? fallbackRound : fallbackRound;
  const category = clean(raw.category ?? raw.cat);
  const clue = clean(raw.clue ?? raw.q);
  const correctResponse = clean(raw.answer ?? raw.a);
  const value = parseValue(raw.value ?? raw.val, fallbackValue);

  const required: Array<[field: string, value: string | undefined]> = [
    ["category", category],
    ["clue", clue],
    ["answer", correctResponse],
  ];
  for (const [field, valueToCheck] of required) {
    if (!valueToCheck) {
      issues.push({
        severity: "error",
        code: "missing-field",
        message: `Missing ${field} on row ${row}.`,
        row,
        field,
      });
    }
  }

  if (!Number.isFinite(value) || value < 0) {
    issues.push({
      severity: "error",
      code: "invalid-value",
      message: `Invalid clue value on row ${row}.`,
      row,
      field: "value",
    });
  }

  if (!category || !clue || !correctResponse || !Number.isFinite(value) || value < 0) {
    return [];
  }

  return [
    {
      id: buildClueId(idPrefix, raw, row),
      round,
      category,
      value,
      clue,
      correctResponse,
      dailyDouble: parseBoolean(raw.dailyDouble ?? raw.dd),
    },
  ];
}

function finalizeGame({
  id,
  source,
  title,
  metadata,
  clues,
  issues,
}: NormalizedGame & { issues: GameDataIssue[] }): GameDataNormalizationResult {
  const seen = new Set<string>();
  for (const clue of clues) {
    if (seen.has(clue.id)) {
      issues.push({
        severity: "error",
        code: "duplicate-clue-id",
        message: `Duplicate clue id "${clue.id}".`,
      });
    }
    seen.add(clue.id);
  }

  if (clues.length === 0) {
    issues.push({
      severity: "error",
      code: "empty-input",
      message: "No valid clues were found.",
    });
  }

  if (issues.some((issue) => issue.severity === "error")) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    game: {
      id,
      source,
      title,
      metadata,
      clues,
    },
    issues,
  };
}

function normalizeRound(input: string | undefined): PlayableRound | undefined {
  if (!input) {
    return undefined;
  }
  return roundAliases.get(
    input
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z-]/g, ""),
  );
}

function clean(input: unknown) {
  return typeof input === "string" ? input.trim() : undefined;
}

function inferValue(
  round: PlayableRound,
  raw: ArchivedRawClue | CustomCsvRow,
  index: number,
  multiplier: number,
) {
  const explicit = parseValue(raw.value ?? raw.val, Number.NaN);
  if (Number.isFinite(explicit)) {
    return explicit;
  }
  if (round === "final-jeopardy") {
    return 0;
  }
  const y = parseValue(raw.y, index + 1);
  return y * 200 * multiplier;
}

function parseValue(input: unknown, fallback: number) {
  if (typeof input === "number") {
    return input;
  }
  if (typeof input === "string" && input.trim()) {
    const parsed = Number(input.replace(/[$,]/g, "").trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function parseBoolean(input: unknown) {
  if (typeof input === "boolean") {
    return input;
  }
  if (typeof input === "string") {
    return ["1", "true", "yes", "y"].includes(input.trim().toLowerCase());
  }
  return false;
}

function multiplierFor(round: PlayableRound) {
  return roundDefinitions.find((definition) => definition.round === round)
    ?.valueMultiplier ?? 1;
}

function buildClueId(
  idPrefix: string,
  raw: ArchivedRawClue | CustomCsvRow,
  row: number,
) {
  const x = parseValue(raw.x, Number.NaN);
  const y = parseValue(raw.y, Number.NaN);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    return `${idPrefix}-${x}-${y}`;
  }
  return `${idPrefix}-${row}`;
}

function categorySlug(category: string | undefined) {
  return (category || "uncategorized")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function stableId(parts: Array<string | undefined>) {
  const input = parts.filter(Boolean).join(":") || "jeopardy-game";
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return `game-${hash.toString(36)}`;
}
