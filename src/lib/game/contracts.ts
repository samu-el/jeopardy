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
  /** How long a Daily Double wager stays open. */
  wagerTimeoutMs: number;
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
  /** When the wager prompt opened, so a client can size its countdown. */
  wagerWindowStartsAt?: number;
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
  /** Players whose answer clock ran out before they sent anything. */
  answerTimedOut?: string[];
  /**
   * When the buzzer re-opened after a wrong answer. Lets a client time the
   * rebound window from its real start rather than from the first readout.
   */
  reboundOpenedAt?: number;
}

/** One contestant's Final Jeopardy, kept after the clue leaves the board. */
export interface FinalJeopardyEntry {
  playerId: string;
  answer: string;
  wager: number;
  /** The ruling, or undefined if the clue closed before one was made. */
  correct?: boolean | null;
}

export interface FinalJeopardyRecord {
  clueId: string;
  /** In reveal order: lowest score going in, first. */
  entries: FinalJeopardyEntry[];
}

/** A contestant's place in the scores, ties sharing a rank (1, 1, 3). */
export interface Standing {
  playerId: string;
  score: number;
  rank: number;
}

export interface WagerLimits {
  min: number;
  max: number;
  /**
   * True when the ceiling is the player's own score — "making it a true
   * Daily Double" — rather than the house maximum they get when trailing it.
   */
  maxIsScore: boolean;
}

/** Why a wager was not taken exactly as sent. */
export type WagerAdjustment = "above-max" | "below-min" | "not-a-number";

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
  /** How Final Jeopardy went, once it has been played. */
  finalJeopardy?: FinalJeopardyRecord;
  /**
   * The position just before the last reveal or ruling. `undo` restores it,
   * which is how a host reverses a misjudged answer.
   */
  undoSnapshot?: GameStateSnapshot;
}

/** A player as the table sees them: their seat, plus the score. */
export type PublicPlayerState = GamePlayer & { score: number };

export interface PublicBoardClue {
  id: string;
  category: string;
  value: number;
  revealed: boolean;
  clue?: string;
}

/**
 * The clue on the board as a client may see it.
 *
 * Derived from the room's own clue rather than restated: the same twenty-odd
 * fields, minus the three the room keeps to itself, plus what the client
 * would otherwise have to work out. Written out twice, the two drifted every
 * time a window was added.
 */
export type PublicActiveClueState = Omit<
  ActiveClueState,
  "clueRevealed" | "answerRevealed" | "judgeQueue"
> & {
  category: string;
  value: number;
  /** Withheld until the clue goes up, and the response until it is revealed. */
  clue?: string;
  correctResponse?: string;
  /** Whether this client could ring in right now, worked out server-side. */
  canBuzz: boolean;
  /** What sort of clue this is, so a label never says "rang in" on a Final. */
  kind: PublicClueKind;
  /** Where the clue is in its life; see `PublicCluePhase`. */
  phase: PublicCluePhase;
  /** True while the buzzer is open again after a wrong answer. */
  rebound: boolean;
  /**
   * True once the clue is settled and nobody can ring in on it any more —
   * the only time `correctResponse` is sent to the table.
   */
  responseFinal: boolean;
  /** Limits for each player still owing a wager, so a client can validate. */
  wagerLimits: Record<string, WagerLimits>;
};

export type PublicClueKind = "standard" | "daily-double" | "final";

/**
 * - `wager`: waiting on wagers.
 * - `reading`: the clue is up and the buzzer is still locked.
 * - `buzzing`: anyone eligible may ring in (see `rebound`).
 * - `answering`: someone owes an answer.
 * - `judging`: answers are in and the host is ruling.
 * - `resolved`: settled; the board comes back at `closesAt`, if set.
 */
export type PublicCluePhase =
  | "wager"
  | "reading"
  | "buzzing"
  | "answering"
  | "judging"
  | "resolved";

export interface PublicFinalJeopardy extends FinalJeopardyRecord {
  category: string;
  clue: string;
  correctResponse: string;
}

export interface PublicResults {
  /** Everyone tied for the top score who finished above zero. */
  winners: string[];
  /** Everyone tied for the top score, whatever it is. */
  leaders: string[];
  finalJeopardy?: PublicFinalJeopardy;
}

export interface PublicGameState {
  roomId: string;
  round: GameRound;
  serverTime: number;
  pickerId?: string;
  /**
   * Everyone in the room — spectators and displays included — in seat order,
   * which never changes with the score. Use `standings` to rank.
   */
  players: PublicPlayerState[];
  /** Contestants only, best score first; ties share a rank. Always set by the projection. */
  standings?: Standing[];
  /** Head counts, with spectators and displays kept apart from contestants. */
  audience?: { contestants: number; spectators: number; connectedContestants: number };
  /** Set once the game is over. */
  results?: PublicResults;
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
      /**
       * The reading client is still speaking: hold the buzzer until at least
       * `endsAt`. Only ever pushes the window later; `readout-complete` is
       * what brings it forward.
       */
      type: "extend-readout";
      actorId: string;
      clueId: string;
      endsAt: number;
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
      /** What was actually staked. */
      amount: number;
      /** What was asked for, when it differs from `amount`. */
      requestedAmount?: number;
      /** Why the amount was changed, so the player can be told. */
      adjusted?: WagerAdjustment;
      min: number;
      max: number;
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
      displayName: string;
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

/**
 * What each round is called out loud.
 *
 * Three modules used to keep their own spelling of this — one for the avatar
 * host, one for the room's chat log, one for the game builder — and they
 * disagreed about whether Double Jeopardy took an exclamation mark.
 */
export const roundNames: Record<
  GameRound,
  { plain: string; spoken: string; announced: string }
> = {
  lobby: { plain: "Lobby", spoken: "the lobby", announced: "Lobby" },
  jeopardy: { plain: "Jeopardy", spoken: "Jeopardy", announced: "Jeopardy! round" },
  "double-jeopardy": {
    plain: "Double Jeopardy",
    spoken: "Double Jeopardy",
    announced: "Double Jeopardy! round",
  },
  "triple-jeopardy": {
    plain: "Triple Jeopardy",
    spoken: "Triple Jeopardy",
    announced: "Triple Jeopardy! round",
  },
  "final-jeopardy": {
    plain: "Final Jeopardy",
    spoken: "Final Jeopardy",
    announced: "Final Jeopardy!",
  },
  complete: {
    plain: "Complete",
    spoken: "the end of the game",
    announced: "That's the game.",
  },
};

export function roundName(
  round: string,
  style: "plain" | "spoken" | "announced" = "plain",
): string {
  return roundNames[round as GameRound]?.[style] ?? round;
}
