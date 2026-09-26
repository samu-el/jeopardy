/**
 * The rules of the game, with no commands in sight.
 *
 * Everything here answers a question about a position — may this player ring
 * in, who picks next, what is this wager worth, is the round over — or does
 * one small mechanical thing to a copy of the state. The command handlers in
 * `clue-flow.ts` and `room-flow.ts` are then mostly a list of rules and a
 * short edit, which is the shape they should have been all along.
 */
import {
  type ActiveClueState,
  type CommandRejectionCode,
  type GameClue,
  type GameCommand,
  type GameEngineResult,
  type GameEvent,
  type GamePlayer,
  type GameRound,
  type GameSettings,
  type GameState,
  type GameStateSnapshot,
  type GameStats,
  type PlayableRound,
  type Standing,
  type WagerAdjustment,
  type WagerLimits,
  gameRoundOrder,
} from "./contracts";

/** Ceiling on seats so a shared room link can't be flooded. */
export const maxPlayersPerRoom = 12;

/**
 * How far ahead a client may hold the buzzer. A readout that claims to run
 * longer than this is a broken or hostile client, not a wordy clue.
 */
export const maxReadoutHoldMs = 60_000;

export const defaultGameSettings: GameSettings = {
  answerTimeoutMs: 8_000,
  buzzWindowMs: 6_000,
  finalTimeoutMs: 30_000,
  wagerTimeoutMs: 15_000,
  buzzUnlockDelayMs: 1_500,
  readoutPerCharMs: 0,
  allowMultipleCorrect: false,
  aiJudgeEnabled: false,
  aiBotsEnabled: false,
  aiAvatarHostEnabled: false,
  // Timed behaviour is opt-in: the engine stays deterministic for tests and
  // the runtime dials in show-accurate values.
  earlyBuzzLockoutMs: 0,
  autoAdvanceMs: 0,
  roundIntroMs: 0,
};

export const playableRounds: PlayableRound[] = [
  "jeopardy",
  "double-jeopardy",
  "triple-jeopardy",
  "final-jeopardy",
];

/**
 * The most a player may always wager on a Daily Double, whatever their score,
 * when a round has no clues to read the real figure from. The show's rule is
 * "your score or the highest value on the board this round, whichever is
 * greater"; see `roundMaxValue`.
 */
const wagerCeilingFloor: Record<GameRound, number> = {
  lobby: 0,
  jeopardy: 1_000,
  "double-jeopardy": 2_000,
  "triple-jeopardy": 3_000,
  "final-jeopardy": 0,
  complete: 0,
};

export function createEmptyStats(): GameStats {
  return {
    questionsStarted: 0,
    answeredByPlayer: {},
    correctByPlayer: {},
    incorrectByPlayer: {},
    firstBuzzByPlayer: {},
    reactionTimesByPlayer: {},
    dailyDoublesByPlayer: {},
  };
}

export function emptyClueIndex(): Record<PlayableRound, string[]> {
  return { jeopardy: [], "double-jeopardy": [], "triple-jeopardy": [], "final-jeopardy": [] };
}

// ---------------------------------------------------------------------------
// Editing a position
// ---------------------------------------------------------------------------

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function touch<T extends GameState>(state: T, now: number): T {
  return { ...state, updatedAt: now };
}

/** A shallow change to the state, stamped with the time it happened. */
export function patch(state: GameState, now: number, changes: Partial<GameState>): GameState {
  return { ...state, ...changes, updatedAt: now };
}

/**
 * Copies the position, hands the copy to `apply` to rearrange in place, and
 * returns it stamped along with whatever events `apply` reports. The copy is
 * private until it is returned, so mutating it is the clearest way to write
 * these — no `next.activeClue!.buzzes` chains three levels deep.
 */
export function edit(
  state: GameState,
  now: number,
  apply: (draft: GameState) => GameEvent[] | void,
): GameEngineResult {
  const draft = clone(state);
  const events = apply(draft) ?? [];
  return { state: touch(draft, now), events };
}

/** `edit`, for commands that can only run while a clue is on the board. */
export function editClue(
  state: GameState,
  now: number,
  apply: (clue: ActiveClueState, draft: GameState) => GameEvent[] | void,
): GameEngineResult {
  return edit(state, now, (draft) => apply(draft.activeClue!, draft));
}

export function snapshotState(state: GameState): GameStateSnapshot {
  const snapshot = clone(state);
  delete snapshot.undoSnapshot;
  return snapshot;
}

// ---------------------------------------------------------------------------
// Saying no
// ---------------------------------------------------------------------------

/** One condition a command has to satisfy, and what to say when it doesn't. */
export type Rule = readonly [allowed: unknown, reason: CommandRejectionCode, message: string];

export function reject(
  state: GameState,
  command: GameCommand,
  reason: CommandRejectionCode,
  message: string,
): GameEngineResult {
  return {
    state,
    events: [
      {
        type: "command-rejected",
        commandType: command.type,
        actorId: "actorId" in command ? command.actorId : undefined,
        reason,
        message,
      },
    ],
  };
}

/**
 * The first rule this command breaks, as a rejection — or nothing, when it
 * breaks none. Rules are read in order, so they can be listed from the most
 * basic ("is there even a clue up?") to the most particular.
 */
export function refuse(
  state: GameState,
  command: GameCommand,
  rules: readonly Rule[],
): GameEngineResult | undefined {
  const broken = rules.find(([allowed]) => !allowed);
  return broken ? reject(state, command, broken[1], broken[2]) : undefined;
}

export function isActivePlayer(state: GameState, actorId: string): boolean {
  const player = state.players[actorId];
  return Boolean(player && !player.spectator);
}

/** An unhosted room lets anyone run the board; a hosted one lets only the host. */
export function isHostOrOpenRoom(state: GameState, actorId: string | undefined): boolean {
  return !state.settings.hostId || state.settings.hostId === actorId;
}

export function isHostOrPicker(state: GameState, actorId: string): boolean {
  return state.settings.hostId === actorId || state.pickerId === actorId;
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export function getActivePlayers(state: GameState): GamePlayer[] {
  return Object.values(state.players).filter((player) => !player.spectator);
}

export function remainingActivePlayers(state: GameState, active: ActiveClueState) {
  return getActivePlayers(state).filter((player) => active.judges[player.id] === undefined);
}

export function sanitizeName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, 24);
}

export function bumpStat(record: Record<string, number>, playerId: string) {
  record[playerId] = (record[playerId] ?? 0) + 1;
}

/** Strips a departed player out of the clue on the board. */
export function withoutPlayer(active: ActiveClueState, playerId: string): ActiveClueState {
  const stripped = clone(active);
  for (const book of [
    stripped.buzzes,
    stripped.answers,
    stripped.submitted,
    stripped.wagers,
    stripped.judges,
    stripped.lockouts,
  ] as Record<string, unknown>[]) {
    delete book[playerId];
  }
  stripped.waitingForWager = stripped.waitingForWager.filter((id) => id !== playerId);
  stripped.judgeQueue = stripped.judgeQueue.filter((id) => id !== playerId);
  if (stripped.currentJudgePlayerId === playerId) {
    stripped.currentJudgePlayerId = stripped.judgeQueue.find(
      (id) => stripped.judges[id] === undefined,
    );
    stripped.canAdvance = stripped.currentJudgePlayerId === undefined;
  }
  return stripped;
}

/**
 * Who opens the board.
 *
 * The first round opens with a host at a lectern, if there is one — they
 * pressed start — and otherwise with the lowest score. Every later round opens
 * with the trailing contestant, the way the show does it, so a seated host no
 * longer gets the first pick of Double Jeopardy for free. Ties go to the
 * earliest seat.
 */
export function selectPicker(
  state: GameState,
  opening: "first-round" | "later-round" = "first-round",
): string | undefined {
  const hostId = state.settings.hostId;
  if (
    opening === "first-round" &&
    hostId &&
    state.players[hostId] &&
    !state.players[hostId].spectator
  ) {
    return hostId;
  }
  const seats = seatOrder(state);
  return getActivePlayers(state)
    .map((player) => ({ id: player.id, score: state.scores[player.id] ?? 0 }))
    .sort((a, b) => a.score - b.score || seats.indexOf(a.id) - seats.indexOf(b.id))[0]?.id;
}

/**
 * Everyone in the room, in the order they sat down. Podiums use this so a
 * lectern never jumps sideways when a score changes; ranking is separate.
 */
export function seatOrder(state: GameState): string[] {
  return Object.values(state.players)
    .map((player, index) => ({ id: player.id, index, joinedAt: player.joinedAt }))
    .sort(
      (a, b) =>
        (a.joinedAt ?? Number.NEGATIVE_INFINITY) - (b.joinedAt ?? Number.NEGATIVE_INFINITY) ||
        a.index - b.index,
    )
    .map((seat) => seat.id);
}

/** Contestants only — spectators and displays are never ranked. */
export function getStandings(state: GameState): Standing[] {
  const seats = seatOrder(state);
  const sorted = getActivePlayers(state)
    .map((player) => ({ playerId: player.id, score: state.scores[player.id] ?? 0 }))
    .sort((a, b) => b.score - a.score || seats.indexOf(a.playerId) - seats.indexOf(b.playerId));
  return sorted.map((entry) => ({
    ...entry,
    rank: sorted.findIndex((other) => other.score === entry.score) + 1,
  }));
}

/** Everyone tied for the top score. Empty when there are no contestants. */
export function getLeaders(state: GameState): string[] {
  return getStandings(state)
    .filter((entry) => entry.rank === 1)
    .map((entry) => entry.playerId);
}

/**
 * Who won. On the show a contestant has to finish in the black to win, so a
 * table that ends at or below zero has no winner; a tie at the top has
 * several.
 */
export function getWinners(state: GameState): string[] {
  return getLeaders(state).filter((id) => (state.scores[id] ?? 0) > 0);
}

/** The best score at the table other than this player's own. */
export function leadingOpponentScore(state: GameState, playerId: string): number {
  const others = getActivePlayers(state)
    .filter((player) => player.id !== playerId)
    .map((player) => state.scores[player.id] ?? 0);
  return others.length > 0 ? Math.max(...others) : 0;
}

/**
 * Who plays Final Jeopardy: contestants who finished the last round in the
 * black. Anyone at or below zero sits it out — no wager box, and the room
 * does not wait on them.
 */
export function getFinalists(state: GameState): GamePlayer[] {
  return getActivePlayers(state).filter((player) => (state.scores[player.id] ?? 0) > 0);
}

// ---------------------------------------------------------------------------
// The clue on the board
// ---------------------------------------------------------------------------

export function createActiveClue(clue: GameClue): ActiveClueState {
  return {
    clueId: clue.id,
    round: clue.round,
    clueRevealed: false,
    answerRevealed: false,
    dailyDouble: Boolean(clue.dailyDouble),
    waitingForWager: [],
    buzzes: {},
    answers: {},
    submitted: {},
    wagers: {},
    judges: {},
    judgeQueue: [],
    canAdvance: false,
    lockouts: {},
  };
}

/**
 * Puts the clue up and starts its clocks.
 *
 * The readout window is a base lockout plus per-character scaling, so a wordy
 * clue isn't cut off and a short one doesn't drag. A wagered clue and Final
 * have no ring-in window at all: the players who owe an answer are already
 * known, so they are marked in as if they had rung in the moment it appeared.
 */
export function revealActiveClue(
  activeClue: ActiveClueState,
  answerTimeoutMs: number,
  now: number,
  state: GameState,
) {
  const clue = state.cluesById[activeClue.clueId];
  activeClue.clueRevealed = true;
  activeClue.readoutEndsAt =
    now + state.settings.buzzUnlockDelayMs + clue.clue.length * state.settings.readoutPerCharMs;
  activeClue.buzzWindowEndsAt = activeClue.readoutEndsAt + state.settings.buzzWindowMs;
  activeClue.answerWindowEndsAt = undefined;
  activeClue.wagerWindowStartsAt = undefined;
  activeClue.wagerWindowEndsAt = undefined;

  const owed =
    activeClue.round === "final-jeopardy"
      ? getFinalists(state).map((player) => player.id)
      : activeClue.dailyDoublePlayerId
        ? [activeClue.dailyDoublePlayerId]
        : [];
  if (owed.length === 0) return;

  for (const playerId of owed) {
    activeClue.buzzes[playerId] = activeClue.readoutEndsAt;
  }
  activeClue.answerWindowEndsAt = activeClue.readoutEndsAt + answerTimeoutMs;
  activeClue.buzzWindowEndsAt = activeClue.readoutEndsAt;
}

/** How long the player who owes this clue an answer gets. */
export function answerTimeoutFor(state: GameState, round: GameRound): number {
  return round === "final-jeopardy"
    ? state.settings.finalTimeoutMs
    : state.settings.answerTimeoutMs;
}

export function canBuzz(active: ActiveClueState, now: number): boolean {
  return (
    active.clueRevealed &&
    !active.answerRevealed &&
    !active.dailyDoublePlayerId &&
    active.round !== "final-jeopardy" &&
    active.waitingForWager.length === 0 &&
    Object.keys(active.buzzes).length === 0 &&
    Boolean(active.readoutEndsAt) &&
    now >= (active.readoutEndsAt ?? Number.POSITIVE_INFINITY) &&
    now <= (active.buzzWindowEndsAt ?? Number.NEGATIVE_INFINITY)
  );
}

export function canSubmitAnswer(
  active: ActiveClueState,
  playerId: string,
  now: number,
): boolean {
  return (
    active.clueRevealed &&
    !active.answerRevealed &&
    active.waitingForWager.length === 0 &&
    active.buzzes[playerId] !== undefined &&
    now <= (active.answerWindowEndsAt ?? Number.NEGATIVE_INFINITY)
  );
}

/** The biggest clue on this round's board, which sets a Daily Double's ceiling. */
export function roundMaxValue(state: GameState, round: GameRound): number {
  if (round === "lobby" || round === "complete" || round === "final-jeopardy") {
    return wagerCeilingFloor[round];
  }
  const values = state.clueIdsByRound[round].map((id) => state.cluesById[id]?.value ?? 0);
  return values.length > 0 ? Math.max(...values) : wagerCeilingFloor[round];
}

/**
 * What this player may wager right now. Daily Double: at least $5, at most
 * their score or the round's biggest clue, whichever is greater. Final
 * Jeopardy: anywhere from $0 to their score.
 */
export function wagerLimitsFor(
  state: GameState,
  playerId: string,
  round: GameRound,
): WagerLimits {
  const score = state.scores[playerId] ?? 0;
  if (round === "final-jeopardy") {
    return { min: 0, max: Math.max(score, 0), maxIsScore: true };
  }
  const house = roundMaxValue(state, round);
  return { min: 5, max: Math.max(score, house), maxIsScore: score >= house };
}

/**
 * Nobody may bet more than their limit or less than the house minimum. Says
 * how the amount was changed, so the table can be told instead of finding
 * out when the score moves.
 */
export function clampWager(
  amount: number,
  limits: Pick<WagerLimits, "min" | "max">,
): { amount: number; adjusted?: WagerAdjustment } {
  const { min, max } = limits;
  if (!Number.isFinite(amount)) return { amount: min, adjusted: "not-a-number" };
  const whole = Math.trunc(amount);
  if (whole > max) return { amount: max, adjusted: "above-max" };
  if (whole < min) return { amount: min, adjusted: "below-min" };
  return { amount: whole };
}

/**
 * Whether a wrong ruling on this clue could still hand it to someone else:
 * a contestant who has neither rung in nor been ruled on. Never on a Daily
 * Double or in Final — those belong to the players who wagered.
 */
export function reboundPossible(state: GameState, active: ActiveClueState): boolean {
  if (active.dailyDoublePlayerId || active.round === "final-jeopardy") return false;
  return getActivePlayers(state).some(
    (player) =>
      active.judges[player.id] === undefined && active.buzzes[player.id] === undefined,
  );
}

/**
 * Whether the correct response may be shown to the table. Only once the clue
 * is settled — ruled right, or nobody left who could ring in on a rebound —
 * so nobody gets to buzz on an answer they have just been shown.
 */
export function isResponsePublic(state: GameState, active: ActiveClueState): boolean {
  return active.answerRevealed && (active.canAdvance || !reboundPossible(state, active));
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

export function introDeadline(state: GameState, now: number): number | undefined {
  return state.settings.roundIntroMs > 0 ? now + state.settings.roundIntroMs : undefined;
}

export function getFirstPlayableRound(state: GameState): PlayableRound | undefined {
  return playableRounds.find((round) => state.clueIdsByRound[round].length > 0);
}

export function getNextRoundWithClues(
  state: GameState,
  currentRound: GameRound,
): PlayableRound | undefined {
  const currentIndex = gameRoundOrder.indexOf(currentRound);
  return playableRounds.find(
    (round) =>
      gameRoundOrder.indexOf(round) > currentIndex &&
      state.clueIdsByRound[round].some((clueId) => !state.revealedClueIds.includes(clueId)),
  );
}

export function isRoundComplete(state: GameState, round: GameRound): boolean {
  if (round === "lobby" || round === "complete") return false;
  return state.clueIdsByRound[round].every((clueId) => state.revealedClueIds.includes(clueId));
}

export function getBoardForRound(state: GameState, round: GameRound): GameClue[] {
  if (round === "lobby" || round === "complete") return [];
  return state.clueIdsByRound[round].map((clueId) => state.cluesById[clueId]);
}

/**
 * Rolls the board over to the next round that still has clues, or ends the
 * game. Final Jeopardy opens differently from the others: it puts its one
 * clue up immediately and asks the whole table to wager.
 *
 * Mutates the draft it is given — it only ever runs inside an `edit`.
 */
export function advanceToNextRound(draft: GameState, now: number): GameEvent[] {
  const nextRound = getNextRoundWithClues(draft, draft.round);
  if (!nextRound) {
    draft.round = "complete";
    draft.pickerId = undefined;
    return [{ type: "round-advanced", round: "complete" }];
  }

  draft.round = nextRound;
  draft.pickerId =
    nextRound === "final-jeopardy" ? undefined : selectPicker(draft, "later-round");
  draft.roundIntroEndsAt = introDeadline(draft, now);
  const events: GameEvent[] = [{ type: "round-advanced", round: nextRound }];

  if (nextRound !== "final-jeopardy") return events;

  const finalClueId = draft.clueIdsByRound["final-jeopardy"].find(
    (clueId) => !draft.revealedClueIds.includes(clueId),
  );
  if (!finalClueId) return events;

  const activeClue = createActiveClue(draft.cluesById[finalClueId]);
  draft.activeClue = activeClue;
  activeClue.waitingForWager = getFinalists(draft).map((player) => player.id);
  if (activeClue.waitingForWager.length === 0) {
    // Nobody finished in the black: there is no one to wager, so the clue
    // simply goes up once the title card clears and plays out to the answer.
    revealActiveClue(activeClue, 0, now + draft.settings.roundIntroMs, draft);
    return events;
  }
  activeClue.wagerWindowStartsAt = now + draft.settings.roundIntroMs;
  activeClue.wagerWindowEndsAt =
    now + draft.settings.roundIntroMs + draft.settings.finalTimeoutMs;
  events.push({
    type: "wager-requested",
    clueId: finalClueId,
    playerIds: [...activeClue.waitingForWager],
    deadline: activeClue.wagerWindowEndsAt,
  });
  return events;
}
