export const gameRoundOrder = [
  "lobby",
  "jeopardy",
  "double-jeopardy",
  "triple-jeopardy",
  "final-jeopardy",
  "complete",
] as const;

export type GameRound = (typeof gameRoundOrder)[number];

export type PlayableRound = Exclude<GameRound, "lobby" | "complete">;

export type PlayerKind = "human" | "ai-bot";

export interface GamePlayer {
  id: string;
  displayName: string;
  kind: PlayerKind;
  connected: boolean;
  spectator: boolean;
}

export interface GameClue {
  id: string;
  round: PlayableRound;
  category: string;
  value: number;
  clue: string;
  correctResponse: string;
  dailyDouble?: boolean;
}

export interface GameStats {
  questionsStarted: number;
  answeredByPlayer: Record<string, number>;
  correctByPlayer: Record<string, number>;
  incorrectByPlayer: Record<string, number>;
  firstBuzzByPlayer: Record<string, number>;
  reactionTimesByPlayer: Record<string, number[]>;
  dailyDoublesByPlayer: Record<string, number>;
}

export interface GameSettings {
  answerTimeoutMs: number;
  finalTimeoutMs: number;
  buzzUnlockDelayMs: number;
  allowMultipleCorrect: boolean;
  hostId?: string;
  voiceProfileId?: string;
  avatarHostProfileId?: string;
  aiJudgeEnabled: boolean;
  aiBotsEnabled: boolean;
  aiAvatarHostEnabled: boolean;
}

export interface ActiveClueState {
  clueId: string;
  round: PlayableRound;
  clueRevealed: boolean;
  answerRevealed: boolean;
  dailyDouble: boolean;
  dailyDoublePlayerId?: string;
  readoutEndsAt?: number;
  answerWindowEndsAt?: number;
  wagerWindowEndsAt?: number;
  waitingForWager: string[];
  buzzes: Record<string, number>;
  answers: Record<string, string>;
  submitted: Record<string, boolean>;
  wagers: Record<string, number>;
  judges: Record<string, boolean | null>;
  judgeQueue: string[];
  currentJudgePlayerId?: string;
  canAdvance: boolean;
}

export type GameStateSnapshot = Omit<GameState, "undoSnapshot">;

export interface GameState {
  roomId: string;
  round: GameRound;
  createdAt: number;
  updatedAt: number;
  players: Record<string, GamePlayer>;
  scores: Record<string, number>;
  cluesById: Record<string, GameClue>;
  clueIdsByRound: Record<PlayableRound, string[]>;
  revealedClueIds: string[];
  pickerId?: string;
  activeClue?: ActiveClueState;
  settings: GameSettings;
  stats: GameStats;
  undoSnapshot?: GameStateSnapshot;
}

export interface PublicPlayerState {
  id: string;
  displayName: string;
  kind: PlayerKind;
  connected: boolean;
  spectator: boolean;
  score: number;
}

export interface PublicBoardClue {
  id: string;
  category: string;
  value: number;
  revealed: boolean;
  clue?: string;
}

export interface PublicActiveClueState {
  clueId: string;
  round: PlayableRound;
  category: string;
  value: number;
  clue?: string;
  correctResponse?: string;
  dailyDouble: boolean;
  dailyDoublePlayerId?: string;
  readoutEndsAt?: number;
  answerWindowEndsAt?: number;
  wagerWindowEndsAt?: number;
  waitingForWager: string[];
  canBuzz: boolean;
  buzzes: Record<string, number>;
  answers: Record<string, string>;
  wagers: Record<string, number>;
  judges: Record<string, boolean | null>;
  currentJudgePlayerId?: string;
  canAdvance: boolean;
}

export interface PublicGameState {
  roomId: string;
  round: GameRound;
  serverTime: number;
  pickerId?: string;
  players: PublicPlayerState[];
  board: PublicBoardClue[];
  currentClue?: PublicActiveClueState;
  settings: Pick<
    GameSettings,
    | "allowMultipleCorrect"
    | "hostId"
    | "voiceProfileId"
    | "avatarHostProfileId"
    | "aiJudgeEnabled"
    | "aiBotsEnabled"
    | "aiAvatarHostEnabled"
  >;
  stats: GameStats;
}

export interface CreateGameInput {
  roomId: string;
  players: GamePlayer[];
  clues: GameClue[];
  settings?: Partial<GameSettings>;
  now: number;
}

export type GameCommand =
  | {
      type: "start-game";
      actorId: string;
    }
  | {
      type: "pick-clue";
      actorId: string;
      clueId: string;
    }
  | {
      type: "submit-wager";
      actorId: string;
      amount: number;
    }
  | {
      type: "buzz";
      actorId: string;
    }
  | {
      type: "submit-answer";
      actorId: string;
      answer: string;
    }
  | {
      type: "reveal-answer";
      actorId?: string;
    }
  | {
      type: "judge-answer";
      actorId: string;
      targetPlayerId: string;
      correct: boolean | null;
    }
  | {
      type: "skip";
      actorId?: string;
    }
  | {
      type: "undo";
      actorId: string;
    }
  | {
      type: "update-settings";
      actorId: string;
      settings: Partial<GameSettings>;
    }
  | {
      type: "add-bot";
      actorId: string;
      bot: Omit<GamePlayer, "kind" | "connected" | "spectator">;
    }
  | {
      type: "configure-host";
      actorId: string;
      hostId?: string;
    };

export type CommandRejectionCode =
  | "game-already-started"
  | "game-not-started"
  | "not-found"
  | "not-authorized"
  | "not-active-player"
  | "not-current-picker"
  | "clue-already-active"
  | "clue-already-revealed"
  | "clue-not-in-round"
  | "wager-not-open"
  | "buzz-not-open"
  | "already-buzzed"
  | "answer-not-open"
  | "already-submitted"
  | "answer-not-revealed"
  | "already-judged"
  | "cannot-advance"
  | "undo-unavailable"
  | "invalid-command";

export type GameEvent =
  | {
      type: "command-rejected";
      commandType: GameCommand["type"];
      actorId?: string;
      reason: CommandRejectionCode;
      message: string;
    }
  | {
      type: "game-started";
      round: PlayableRound | "complete";
    }
  | {
      type: "round-advanced";
      round: GameRound;
    }
  | {
      type: "clue-picked";
      clueId: string;
      actorId: string;
      dailyDouble: boolean;
    }
  | {
      type: "wager-requested";
      clueId: string;
      playerIds: string[];
      deadline: number;
    }
  | {
      type: "wager-submitted";
      clueId: string;
      actorId: string;
      amount: number;
    }
  | {
      type: "clue-revealed";
      clueId: string;
      readoutEndsAt: number;
      answerWindowEndsAt: number;
    }
  | {
      type: "buzz-accepted";
      clueId: string;
      actorId: string;
      buzzedAt: number;
      reactionTimeMs: number;
    }
  | {
      type: "answer-submitted";
      clueId: string;
      actorId: string;
      hasAnswer: boolean;
    }
  | {
      type: "answer-revealed";
      clueId: string;
      judgeQueue: string[];
    }
  | {
      type: "answer-judged";
      clueId: string;
      actorId?: string;
      targetPlayerId: string;
      correct: boolean | null;
      delta: number;
    }
  | {
      type: "score-changed";
      playerId: string;
      score: number;
      delta: number;
    }
  | {
      type: "clue-completed";
      clueId: string;
    }
  | {
      type: "settings-updated";
    }
  | {
      type: "bot-added";
      botId: string;
    }
  | {
      type: "host-configured";
      hostId?: string;
    }
  | {
      type: "undo-applied";
    };

export interface GameCommandContext {
  now: number;
}

export interface GameEngineResult {
  state: GameState;
  events: GameEvent[];
}
