import type { GameClue, PlayableRound } from "@/lib/game";

export type GameDataSourceKind = "archived-episode" | "custom-csv";

export type GameDataIssueSeverity = "error" | "warning";

export type GameDataIssueCode =
  | "empty-input"
  | "csv-parse-error"
  | "missing-field"
  | "invalid-round"
  | "invalid-value"
  | "duplicate-clue-id"
  | "empty-round"
  | "unknown-field";

export interface GameDataIssue {
  severity: GameDataIssueSeverity;
  code: GameDataIssueCode;
  message: string;
  row?: number;
  field?: string;
}

export interface NormalizedGameMetadata {
  episodeNumber?: string;
  airDate?: string;
  title?: string;
  notes?: string;
}

export interface NormalizedGame {
  id: string;
  source: GameDataSourceKind;
  title: string;
  metadata: NormalizedGameMetadata;
  clues: GameClue[];
}

export type GameDataNormalizationResult =
  | {
      ok: true;
      game: NormalizedGame;
      issues: GameDataIssue[];
    }
  | {
      ok: false;
      game?: undefined;
      issues: GameDataIssue[];
    };

export interface ArchivedRawClue {
  val?: number | string;
  value?: number | string;
  cat?: string;
  category?: string;
  q?: string;
  clue?: string;
  a?: string;
  answer?: string;
  dd?: boolean | string;
  dailyDouble?: boolean | string;
  x?: number | string;
  y?: number | string;
}

export interface ArchivedEpisodeInput {
  epNum?: string;
  episodeNumber?: string;
  airDate?: string;
  info?: string;
  title?: string;
  jeopardy?: ArchivedRawClue[];
  double?: ArchivedRawClue[];
  triple?: ArchivedRawClue[];
  final?: ArchivedRawClue[];
}

export interface CustomCsvRow {
  round?: string;
  cat?: string;
  category?: string;
  q?: string;
  clue?: string;
  a?: string;
  answer?: string;
  dd?: string;
  dailyDouble?: string;
  val?: string;
  value?: string;
  x?: string;
  y?: string;
}

export interface NormalizationOptions {
  id?: string;
  title?: string;
}

export interface RoundDefinition {
  rawName: string;
  round: PlayableRound;
  valueMultiplier: number;
}
