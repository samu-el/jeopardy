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

/**
 * One clue as it arrives, whatever wrote it.
 *
 * The archive uses three-letter keys and a CSV writes them out; the parser
 * reads either, so both spellings live on one shape rather than on two that
 * have to be kept in step.
 */
export interface RawClueRow {
  round?: string;
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

/** The archive's rows never carry a round: the key they sit under is the round. */
export type ArchivedRawClue = Omit<RawClueRow, "round">;

/** A CSV row says which round it belongs to. */
export type CustomCsvRow = RawClueRow;

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

export interface NormalizationOptions {
  id?: string;
  title?: string;
}

export interface RoundDefinition {
  rawName: string;
  round: PlayableRound;
  valueMultiplier: number;
}

/** One episode as the archive index lists it. */
export interface EpisodeListing {
  id: string;
  number: string;
  airDate?: string;
  info?: string;
  theme: string;
  hasFinal: boolean;
  clueCount: number;
}
