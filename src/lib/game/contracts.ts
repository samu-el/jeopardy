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
  /** Avatar emoji shown on the podium. Shared so every client sees it. */
  emoji?: string;
  /** Podium accent colour. */
  color?: string;
  /** When the player first joined — used for deterministic host migration. */
  joinedAt?: number;
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
  /** Per-buzz answer deadline once a player rings in. */
  answerTimeoutMs: number;
  /** How long after the readout ends that players can ring in. */
  buzzWindowMs: number;
  finalTimeoutMs: number;
  /** Minimum time the readout occupies (lockout for the buzzer). */
  buzzUnlockDelayMs: number;
  /**
   * Additional readout time per character of the clue. Defaults to 0 so
   * tests run on tight timelines; the production runtime sets this to
   * roughly match TTS speech duration.
   */
  readoutPerCharMs: number;
  allowMultipleCorrect: boolean;
  hostId?: string;
  voiceProfileId?: string;
  avatarHostProfileId?: string;
  aiJudgeEnabled: boolean;
  aiBotsEnabled: boolean;
  aiAvatarHostEnabled: boolean;
  /**
   * How long a wrong early buzz locks a player out, matching the show's
   * quarter-second penalty. 0 disables the penalty.
   */
  earlyBuzzLockoutMs: number;
  /**
   * How long a finished clue stays on screen before the board returns.
   * 0 keeps the clue up until the host advances manually.
   */
  autoAdvanceMs: number;
  /** How long the round-title card is shown when a round begins. */
  roundIntroMs: number;
}

export interface ActiveClueState {
  clueId: string;
  round: PlayableRound;
  clueRevealed: boolean;
  answerRevealed: boolean;
  dailyDouble: boolean;
  dailyDoublePlayerId?: string;
  readoutEndsAt?: number;
  /** Until when players can ring in. Closes the buzzer when reached. */
  buzzWindowEndsAt?: number;
  /** Deadline for the currently-buzzed player to submit an answer. */
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
  /** Player id -> timestamp until which an early buzz keeps them locked out. */
  lockouts: Record<string, number>;
  /** When the finished clue auto-closes and the board comes back. */
  closesAt?: number;
  /** Set when nobody rang in, so the UI can say so. */
  timedOut?: boolean;
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
  /** While set, the round title card is showing and picking is paused. */
  roundIntroEndsAt?: number;
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
  emoji?: string;
  color?: string;
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
  buzzWindowEndsAt?: number;
  answerWindowEndsAt?: number;
  wagerWindowEndsAt?: number;
  waitingForWager: string[];
  canBuzz: boolean;
  buzzes: Record<string, number>;
  /** Which players have submitted an answer (content withheld until reveal). */
  submitted: Record<string, boolean>;
  answers: Record<string, string>;
  wagers: Record<string, number>;
  judges: Record<string, boolean | null>;
  currentJudgePlayerId?: string;
  canAdvance: boolean;
  lockouts: Record<string, number>;
  closesAt?: number;
  timedOut?: boolean;
}

export interface PublicGameState {
  roomId: string;
  round: GameRound;
  serverTime: number;
  pickerId?: string;
  players: PublicPlayerState[];
  board: PublicBoardClue[];
  currentClue?: PublicActiveClueState;
  roundIntroEndsAt?: number;
  settings: Pick<
    GameSettings,
    | "allowMultipleCorrect"
    | "hostId"
    | "voiceProfileId"
    | "avatarHostProfileId"
    | "aiJudgeEnabled"
    | "aiBotsEnabled"
    | "aiAvatarHostEnabled"
    | "autoAdvanceMs"
    | "earlyBuzzLockoutMs"
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
      /**
       * Marks the clue readout (TTS) as finished — opens the buzz window
       * immediately rather than waiting for the time-based fallback.
       */
      type: "readout-complete";
      actorId: string;
      clueId: string;
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
    }
  | {
      /** A human takes a seat (or re-takes one after a reconnect). */
      type: "join-game";
      actorId: string;
      displayName: string;
      spectator?: boolean;
      emoji?: string;
      color?: string;
    }
  | {
      type: "leave-game";
      actorId: string;
      targetPlayerId?: string;
    }
  | {
      type: "set-player-profile";
      actorId: string;
      targetPlayerId?: string;
      displayName?: string;
      emoji?: string;
      color?: string;
      spectator?: boolean;
    }
  | {
      /** Host swaps the board for a different episode/custom game. */
      type: "load-game";
      actorId: string;
      clues: GameClue[];
      keepScores?: boolean;
    }
  | {
      /** Time-driven transitions: window expiry, auto-advance, round intros. */
      type: "tick";
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
  | "buzz-locked-out"
  | "room-full"
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
    }
  | {
      type: "player-joined";
      playerId: string;
      displayName: string;
      rejoined: boolean;
    }
  | {
      type: "player-left";
      playerId: string;
    }
  | {
      type: "player-updated";
      playerId: string;
    }
  | {
      type: "game-loaded";
      clueCount: number;
    }
  | {
      type: "buzz-locked-out";
      clueId: string;
      actorId: string;
      until: number;
    }
  | {
      type: "buzz-window-closed";
      clueId: string;
    }
  | {
      type: "answer-timed-out";
      clueId: string;
      playerId: string;
    };

export interface GameCommandContext {
  now: number;
}

export interface GameEngineResult {
  state: GameState;
  events: GameEvent[];
}
