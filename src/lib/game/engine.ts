import {
  type ActiveClueState,
  type CommandRejectionCode,
  type CreateGameInput,
  type GameClue,
  type GameCommand,
  type GameCommandContext,
  type GameEngineResult,
  type GameEvent,
  type GamePlayer,
  type GameRound,
  type GameSettings,
  type GameState,
  type GameStateSnapshot,
  type GameStats,
  type PlayableRound,
  type PublicActiveClueState,
  type PublicBoardClue,
  type PublicGameState,
  type PublicPlayerState,
  gameRoundOrder,
} from "./contracts";

/** Ceiling on seats so a shared room link can't be flooded. */
export const maxPlayersPerRoom = 12;

export const defaultGameSettings: GameSettings = {
  answerTimeoutMs: 8_000,
  buzzWindowMs: 6_000,
  finalTimeoutMs: 30_000,
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

const playableRounds: PlayableRound[] = [
  "jeopardy",
  "double-jeopardy",
  "triple-jeopardy",
  "final-jeopardy",
];

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

export function createGame(input: CreateGameInput): GameState {
  const players = Object.fromEntries(
    input.players.map((player) => [player.id, { ...player }]),
  );
  const scores = Object.fromEntries(input.players.map((player) => [player.id, 0]));
  const cluesById: Record<string, GameClue> = {};
  const clueIdsByRound: Record<PlayableRound, string[]> = {
    jeopardy: [],
    "double-jeopardy": [],
    "triple-jeopardy": [],
    "final-jeopardy": [],
  };

  for (const clue of input.clues) {
    if (cluesById[clue.id]) {
      throw new Error(`Duplicate clue id: ${clue.id}`);
    }
    cluesById[clue.id] = { ...clue };
    clueIdsByRound[clue.round].push(clue.id);
  }

  return {
    roomId: input.roomId,
    round: "lobby",
    createdAt: input.now,
    updatedAt: input.now,
    players,
    scores,
    cluesById,
    clueIdsByRound,
    revealedClueIds: [],
    settings: {
      ...defaultGameSettings,
      ...input.settings,
    },
    stats: createEmptyStats(),
  };
}

export function dispatchGameCommand(
  state: GameState,
  command: GameCommand,
  context: GameCommandContext,
): GameEngineResult {
  switch (command.type) {
    case "start-game":
      return startGame(state, command, context.now);
    case "pick-clue":
      return pickClue(state, command, context.now);
    case "submit-wager":
      return submitWager(state, command, context.now);
    case "buzz":
      return buzz(state, command, context.now);
    case "submit-answer":
      return submitAnswer(state, command, context.now);
    case "reveal-answer":
      return revealAnswer(state, command, context.now);
    case "judge-answer":
      return judgeAnswer(state, command, context.now);
    case "skip":
      return skip(state, command, context.now);
    case "readout-complete":
      return readoutComplete(state, command, context.now);
    case "undo":
      return undo(state, command, context.now);
    case "update-settings":
      return updateSettings(state, command, context.now);
    case "add-bot":
      return addBot(state, command, context.now);
    case "configure-host":
      return configureHost(state, command, context.now);
    case "join-game":
      return joinGame(state, command, context.now);
    case "leave-game":
      return leaveGame(state, command, context.now);
    case "set-player-profile":
      return setPlayerProfile(state, command, context.now);
    case "load-game":
      return loadGame(state, command, context.now);
    case "tick":
      return tickGame(state, context.now);
  }
}

export function getPublicGameState(
  state: GameState,
  now: number,
): PublicGameState {
  const board = getBoardForRound(state, state.round).map((clue) =>
    toPublicBoardClue(state, clue),
  );
  const players = Object.values(state.players)
    .map<PublicPlayerState>((player) => ({
      ...player,
      score: state.scores[player.id] ?? 0,
    }))
    .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));

  return {
    roomId: state.roomId,
    round: state.round,
    serverTime: now,
    pickerId: state.pickerId,
    players,
    board,
    currentClue: state.activeClue
      ? toPublicActiveClue(state, state.activeClue, now)
      : undefined,
    roundIntroEndsAt: state.roundIntroEndsAt,
    settings: {
      allowMultipleCorrect: state.settings.allowMultipleCorrect,
      hostId: state.settings.hostId,
      voiceProfileId: state.settings.voiceProfileId,
      avatarHostProfileId: state.settings.avatarHostProfileId,
      aiJudgeEnabled: state.settings.aiJudgeEnabled,
      aiBotsEnabled: state.settings.aiBotsEnabled,
      aiAvatarHostEnabled: state.settings.aiAvatarHostEnabled,
      autoAdvanceMs: state.settings.autoAdvanceMs,
      earlyBuzzLockoutMs: state.settings.earlyBuzzLockoutMs,
    },
    stats: clone(state.stats),
  };
}

function startGame(
  state: GameState,
  command: Extract<GameCommand, { type: "start-game" }>,
  now: number,
): GameEngineResult {
  if (state.round !== "lobby") {
    return reject(state, command, "game-already-started", "Game already started.");
  }
  if (!isHostOrOpenRoom(state, command.actorId)) {
    return reject(state, command, "not-authorized", "Only the host can start.");
  }

  const nextRound = getFirstPlayableRound(state);
  if (!nextRound) {
    const next = touch({ ...state, round: "complete" }, now);
    return {
      state: next,
      events: [
        { type: "game-started", round: "complete" },
        { type: "round-advanced", round: "complete" },
      ],
    };
  }

  const next = touch(
    {
      ...state,
      round: nextRound,
      pickerId: selectPicker(state),
      roundIntroEndsAt: introDeadline(state, now),
    },
    now,
  );
  return {
    state: next,
    events: [
      { type: "game-started", round: nextRound },
      { type: "round-advanced", round: nextRound },
    ],
  };
}

function pickClue(
  state: GameState,
  command: Extract<GameCommand, { type: "pick-clue" }>,
  now: number,
): GameEngineResult {
  // A host who isn't playing still runs the board, so only non-host
  // spectators are turned away here.
  if (state.settings.hostId !== command.actorId) {
    const playerCheck = requireActivePlayer(state, command.actorId, command);
    if (playerCheck) {
      return playerCheck;
    }
  }
  if (state.round === "lobby" || state.round === "complete") {
    return reject(state, command, "game-not-started", "Game is not in a playable round.");
  }
  if (state.activeClue) {
    return reject(state, command, "clue-already-active", "A clue is already active.");
  }
  if (state.roundIntroEndsAt && now < state.roundIntroEndsAt) {
    return reject(state, command, "cannot-advance", "The round is still being introduced.");
  }
  if (!isHostOrPicker(state, command.actorId)) {
    return reject(
      state,
      command,
      "not-current-picker",
      "Only the current picker or host can choose a clue.",
    );
  }

  const clue = state.cluesById[command.clueId];
  if (!clue) {
    return reject(state, command, "not-found", "Clue was not found.");
  }
  if (clue.round !== state.round) {
    return reject(state, command, "clue-not-in-round", "Clue is not in this round.");
  }
  if (state.revealedClueIds.includes(clue.id)) {
    return reject(state, command, "clue-already-revealed", "Clue was already played.");
  }

  const activeClue = createActiveClue(clue);
  const events: GameEvent[] = [
    {
      type: "clue-picked",
      clueId: clue.id,
      actorId: command.actorId,
      dailyDouble: Boolean(clue.dailyDouble),
    },
  ];

  if (clue.dailyDouble && !state.settings.allowMultipleCorrect) {
    activeClue.dailyDoublePlayerId = command.actorId;
    activeClue.waitingForWager = [command.actorId];
    activeClue.wagerWindowEndsAt = now + state.settings.answerTimeoutMs;
    events.push({
      type: "wager-requested",
      clueId: clue.id,
      playerIds: [command.actorId],
      deadline: activeClue.wagerWindowEndsAt,
    });
  } else {
    revealActiveClue(activeClue, state.settings.answerTimeoutMs, now, state);
    events.push({
      type: "clue-revealed",
      clueId: clue.id,
      readoutEndsAt: activeClue.readoutEndsAt ?? now,
      answerWindowEndsAt: activeClue.answerWindowEndsAt ?? now,
    });
  }

  const next = touch(
    {
      ...state,
      activeClue,
      stats: {
        ...state.stats,
        dailyDoublesByPlayer: activeClue.dailyDoublePlayerId
          ? incrementedRecord(
              state.stats.dailyDoublesByPlayer,
              activeClue.dailyDoublePlayerId,
            )
          : state.stats.dailyDoublesByPlayer,
        questionsStarted: state.stats.questionsStarted + 1,
      },
    },
    now,
  );
  return { state: next, events };
}

function submitWager(
  state: GameState,
  command: Extract<GameCommand, { type: "submit-wager" }>,
  now: number,
): GameEngineResult {
  const active = state.activeClue;
  if (!active || !active.waitingForWager.includes(command.actorId)) {
    return reject(state, command, "wager-not-open", "No wager is open for this player.");
  }
  const playerCheck = requireActivePlayer(state, command.actorId, command);
  if (playerCheck) {
    return playerCheck;
  }

  const next = clone(state);
  const nextActive = next.activeClue!;
  const amount = clampWager(
    command.amount,
    next.round,
    next.scores[command.actorId] ?? 0,
  );
  nextActive.wagers[command.actorId] = amount;
  nextActive.waitingForWager = nextActive.waitingForWager.filter(
    (id) => id !== command.actorId,
  );

  const events: GameEvent[] = [
    {
      type: "wager-submitted",
      clueId: nextActive.clueId,
      actorId: command.actorId,
      amount,
    },
  ];

  if (nextActive.waitingForWager.length === 0) {
    const timeout =
      nextActive.round === "final-jeopardy"
        ? next.settings.finalTimeoutMs
        : next.settings.answerTimeoutMs;
    revealActiveClue(nextActive, timeout, now, next);
    events.push({
      type: "clue-revealed",
      clueId: nextActive.clueId,
      readoutEndsAt: nextActive.readoutEndsAt ?? now,
      answerWindowEndsAt: nextActive.answerWindowEndsAt ?? now,
    });
  }

  return { state: touch(next, now), events };
}

function readoutComplete(
  state: GameState,
  command: Extract<GameCommand, { type: "readout-complete" }>,
  now: number,
): GameEngineResult {
  const active = state.activeClue;
  if (!active || active.clueId !== command.clueId) {
    return reject(state, command, "not-found", "Clue is not active.");
  }
  if (!isHostOrOpenRoom(state, command.actorId)) {
    return reject(state, command, "not-authorized", "Only the host can mark the readout complete.");
  }
  // Daily Double and Final Jeopardy don't have a buzz window — skip.
  if (active.dailyDoublePlayerId || active.round === "final-jeopardy") {
    return { state, events: [] };
  }
  // Already past the readout — nothing to advance.
  if (
    !active.readoutEndsAt ||
    now >= active.readoutEndsAt ||
    Object.keys(active.buzzes).length > 0
  ) {
    return { state, events: [] };
  }

  const next = clone(state);
  const nextActive = next.activeClue!;
  nextActive.readoutEndsAt = now;
  nextActive.buzzWindowEndsAt = now + next.settings.buzzWindowMs;
  return { state: touch(next, now), events: [] };
}

function buzz(
  state: GameState,
  command: Extract<GameCommand, { type: "buzz" }>,
  now: number,
): GameEngineResult {
  const active = state.activeClue;
  if (!active || !active.clueRevealed || active.answerRevealed) {
    return reject(state, command, "buzz-not-open", "Buzzing is not open.");
  }
  const playerCheck = requireActivePlayer(state, command.actorId, command);
  if (playerCheck) {
    return playerCheck;
  }
  const lockedUntil = active.lockouts[command.actorId] ?? 0;
  if (now < lockedUntil) {
    return reject(state, command, "buzz-locked-out", "Buzzer is locked out.");
  }
  if (
    state.settings.earlyBuzzLockoutMs > 0 &&
    active.readoutEndsAt !== undefined &&
    now < active.readoutEndsAt &&
    Object.keys(active.buzzes).length === 0 &&
    active.waitingForWager.length === 0 &&
    active.round !== "final-jeopardy" &&
    !active.dailyDoublePlayerId &&
    active.judges[command.actorId] === undefined
  ) {
    // Rang in before the host finished reading: the show penalises this with
    // a short lockout rather than an outright rejection.
    const nextEarly = clone(state);
    const until = now + state.settings.earlyBuzzLockoutMs;
    nextEarly.activeClue!.lockouts[command.actorId] = until;
    return {
      state: touch(nextEarly, now),
      events: [
        {
          type: "buzz-locked-out",
          clueId: active.clueId,
          actorId: command.actorId,
          until,
        },
      ],
    };
  }
  if (!canBuzz(active, now)) {
    return reject(state, command, "buzz-not-open", "Buzzing is locked.");
  }
  if (active.buzzes[command.actorId] !== undefined) {
    return reject(state, command, "already-buzzed", "Player already buzzed.");
  }
  if (active.judges[command.actorId] !== undefined) {
    return reject(state, command, "already-buzzed", "Player was already judged.");
  }

  const next = clone(state);
  const nextActive = next.activeClue!;
  const reactionTimeMs = now - (nextActive.readoutEndsAt ?? now);
  const firstBuzz = Object.keys(nextActive.buzzes).length === 0;
  nextActive.buzzes[command.actorId] = now;
  // Buzzing closes the ring-in window and starts the answer deadline.
  nextActive.buzzWindowEndsAt = now;
  nextActive.answerWindowEndsAt = now + next.settings.answerTimeoutMs;
  if (firstBuzz) {
    incrementStatFor(command.actorId, next.stats.firstBuzzByPlayer);
  }
  next.stats.reactionTimesByPlayer[command.actorId] = [
    ...(next.stats.reactionTimesByPlayer[command.actorId] ?? []),
    reactionTimeMs,
  ];

  return {
    state: touch(next, now),
    events: [
      {
        type: "buzz-accepted",
        clueId: nextActive.clueId,
        actorId: command.actorId,
        buzzedAt: now,
        reactionTimeMs,
      },
    ],
  };
}

function submitAnswer(
  state: GameState,
  command: Extract<GameCommand, { type: "submit-answer" }>,
  now: number,
): GameEngineResult {
  const active = state.activeClue;
  if (!active || !active.clueRevealed || active.answerRevealed) {
    return reject(state, command, "answer-not-open", "Answering is not open.");
  }
  const playerCheck = requireActivePlayer(state, command.actorId, command);
  if (playerCheck) {
    return playerCheck;
  }
  if (!canSubmitAnswer(active, command.actorId, now)) {
    return reject(state, command, "answer-not-open", "Player cannot submit now.");
  }
  if (active.submitted[command.actorId]) {
    return reject(state, command, "already-submitted", "Player already submitted.");
  }

  const next = clone(state);
  const nextActive = next.activeClue!;
  nextActive.answers[command.actorId] = command.answer;
  nextActive.submitted[command.actorId] = true;
  incrementStatFor(command.actorId, next.stats.answeredByPlayer);

  return {
    state: touch(next, now),
    events: [
      {
        type: "answer-submitted",
        clueId: nextActive.clueId,
        actorId: command.actorId,
        hasAnswer: command.answer.trim().length > 0,
      },
    ],
  };
}

function revealAnswer(
  state: GameState,
  command: Extract<GameCommand, { type: "reveal-answer" }>,
  now: number,
): GameEngineResult {
  const active = state.activeClue;
  if (!active || !active.clueRevealed || active.answerRevealed) {
    return reject(state, command, "answer-not-open", "No answer can be revealed.");
  }
  if (command.actorId && !isHostOrOpenRoom(state, command.actorId)) {
    return reject(state, command, "not-authorized", "Only the host can reveal.");
  }

  const next = clone(state);
  const snapshot = snapshotState(state);
  const nextActive = next.activeClue!;
  for (const playerId of Object.keys(nextActive.buzzes)) {
    if (nextActive.answers[playerId] === undefined) {
      nextActive.answers[playerId] = "";
      nextActive.submitted[playerId] = true;
      incrementStatFor(playerId, next.stats.answeredByPlayer);
    }
  }
  nextActive.answerRevealed = true;
  // Ring-in order everywhere except Final Jeopardy, which the show reveals
  // from the lowest score up.
  nextActive.judgeQueue = Object.keys(nextActive.answers).sort((a, b) =>
    nextActive.round === "final-jeopardy"
      ? (next.scores[a] ?? 0) - (next.scores[b] ?? 0) || a.localeCompare(b)
      : (nextActive.buzzes[a] ?? 0) - (nextActive.buzzes[b] ?? 0),
  );
  nextActive.currentJudgePlayerId = nextActive.judgeQueue[0];
  nextActive.canAdvance = nextActive.judgeQueue.length === 0;
  next.undoSnapshot = snapshot;

  return {
    state: touch(next, now),
    events: [
      {
        type: "answer-revealed",
        clueId: nextActive.clueId,
        judgeQueue: [...nextActive.judgeQueue],
      },
    ],
  };
}

function judgeAnswer(
  state: GameState,
  command: Extract<GameCommand, { type: "judge-answer" }>,
  now: number,
): GameEngineResult {
  const active = state.activeClue;
  if (!active || !active.answerRevealed) {
    return reject(state, command, "answer-not-revealed", "Answer is not revealed.");
  }
  if (!isHostOrOpenRoom(state, command.actorId)) {
    return reject(state, command, "not-authorized", "Only the host can judge.");
  }
  if (active.judges[command.targetPlayerId] !== undefined) {
    return reject(state, command, "already-judged", "Player was already judged.");
  }
  if (
    active.currentJudgePlayerId &&
    active.currentJudgePlayerId !== command.targetPlayerId
  ) {
    return reject(state, command, "invalid-command", "Judge queue is out of order.");
  }

  const next = clone(state);
  const nextActive = next.activeClue!;
  const wager = nextActive.wagers[command.targetPlayerId];
  const clue = next.cluesById[nextActive.clueId];
  const deltaBase = wager ?? clue.value;
  const delta =
    command.correct === true ? deltaBase : command.correct === false ? -deltaBase : 0;
  nextActive.judges[command.targetPlayerId] = command.correct;
  next.scores[command.targetPlayerId] =
    (next.scores[command.targetPlayerId] ?? 0) + delta;

  if (command.correct === true) {
    incrementStatFor(command.targetPlayerId, next.stats.correctByPlayer);
    if (!next.settings.allowMultipleCorrect && next.round !== "final-jeopardy") {
      next.pickerId = command.targetPlayerId;
      nextActive.canAdvance = true;
    }
  }
  if (command.correct === false) {
    incrementStatFor(command.targetPlayerId, next.stats.incorrectByPlayer);
    // Buzzer reopen — in non-final rounds, clear the wrong player's buzz so
    // the rest of the table can ring in for the remaining answer window.
    // The player is still locked from this clue via the `judges` map.
    if (next.round !== "final-jeopardy") {
      delete nextActive.buzzes[command.targetPlayerId];
      delete nextActive.answers[command.targetPlayerId];
      delete nextActive.submitted[command.targetPlayerId];
      nextActive.judgeQueue = nextActive.judgeQueue.filter(
        (id) => id !== command.targetPlayerId,
      );
    }
  }

  if (!nextActive.canAdvance) {
    nextActive.currentJudgePlayerId = nextActive.judgeQueue.find(
      (playerId) => nextActive.judges[playerId] === undefined,
    );
    if (nextActive.currentJudgePlayerId) {
      nextActive.canAdvance = false;
    } else if (
      command.correct === false &&
      next.round !== "final-jeopardy" &&
      nextActive.answerWindowEndsAt &&
      now <= nextActive.answerWindowEndsAt &&
      remainingActivePlayers(next, nextActive).length > 0
    ) {
      // Reopen the clue: hide the answer again and re-open the buzzer
      // for the remaining players. Give them a fresh short window.
      nextActive.answerRevealed = false;
      nextActive.canAdvance = false;
      nextActive.buzzWindowEndsAt = now + next.settings.buzzWindowMs;
      nextActive.answerWindowEndsAt = undefined;
    } else {
      nextActive.canAdvance = true;
    }
  }

  const events: GameEvent[] = [
    {
      type: "answer-judged",
      clueId: nextActive.clueId,
      actorId: command.actorId,
      targetPlayerId: command.targetPlayerId,
      correct: command.correct,
      delta,
    },
  ];
  if (delta !== 0) {
    events.push({
      type: "score-changed",
      playerId: command.targetPlayerId,
      score: next.scores[command.targetPlayerId] ?? 0,
      delta,
    });
  }

  return { state: touch(next, now), events };
}

function skip(
  state: GameState,
  command: Extract<GameCommand, { type: "skip" }>,
  now: number,
): GameEngineResult {
  if (command.actorId && !isHostOrOpenRoom(state, command.actorId)) {
    return reject(state, command, "not-authorized", "Only the host can skip.");
  }
  const active = state.activeClue;
  if (!active || (!active.canAdvance && !active.answerRevealed)) {
    return reject(state, command, "cannot-advance", "Current clue cannot advance.");
  }

  const next = clone(state);
  const clueId = active.clueId;
  next.revealedClueIds = [...new Set([...next.revealedClueIds, clueId])];
  next.activeClue = undefined;
  const events: GameEvent[] = [{ type: "clue-completed", clueId }];

  if (next.round !== "complete" && isRoundComplete(next, next.round)) {
    const advanced = advanceToNextRound(next, now);
    events.push(...advanced.events);
  }

  return { state: touch(next, now), events };
}

function undo(
  state: GameState,
  command: Extract<GameCommand, { type: "undo" }>,
  now: number,
): GameEngineResult {
  if (!isHostOrOpenRoom(state, command.actorId)) {
    return reject(state, command, "not-authorized", "Only the host can undo.");
  }
  if (!state.undoSnapshot) {
    return reject(state, command, "undo-unavailable", "No undo snapshot exists.");
  }
  return {
    state: touch({ ...clone(state.undoSnapshot), undoSnapshot: undefined }, now),
    events: [{ type: "undo-applied" }],
  };
}

function updateSettings(
  state: GameState,
  command: Extract<GameCommand, { type: "update-settings" }>,
  now: number,
): GameEngineResult {
  if (!isHostOrOpenRoom(state, command.actorId)) {
    return reject(state, command, "not-authorized", "Only the host can update settings.");
  }
  return {
    state: touch(
      {
        ...state,
        settings: {
          ...state.settings,
          ...command.settings,
        },
      },
      now,
    ),
    events: [{ type: "settings-updated" }],
  };
}

function addBot(
  state: GameState,
  command: Extract<GameCommand, { type: "add-bot" }>,
  now: number,
): GameEngineResult {
  if (!isHostOrOpenRoom(state, command.actorId)) {
    return reject(state, command, "not-authorized", "Only the host can add bots.");
  }
  if (state.players[command.bot.id]) {
    return reject(state, command, "invalid-command", "Player id is already used.");
  }

  const bot: GamePlayer = {
    ...command.bot,
    kind: "ai-bot",
    connected: true,
    spectator: false,
  };
  return {
    state: touch(
      {
        ...state,
        players: {
          ...state.players,
          [bot.id]: bot,
        },
        scores: {
          ...state.scores,
          [bot.id]: 0,
        },
      },
      now,
    ),
    events: [{ type: "bot-added", botId: bot.id }],
  };
}

function configureHost(
  state: GameState,
  command: Extract<GameCommand, { type: "configure-host" }>,
  now: number,
): GameEngineResult {
  if (state.settings.hostId && state.settings.hostId !== command.actorId) {
    return reject(state, command, "not-authorized", "Only the host can reassign host.");
  }
  if (command.hostId && !state.players[command.hostId]) {
    return reject(state, command, "not-found", "Host player was not found.");
  }
  return {
    state: touch(
      {
        ...state,
        settings: {
          ...state.settings,
          hostId: command.hostId,
        },
        pickerId: command.hostId ?? state.pickerId,
      },
      now,
    ),
    events: [{ type: "host-configured", hostId: command.hostId }],
  };
}


function joinGame(
  state: GameState,
  command: Extract<GameCommand, { type: "join-game" }>,
  now: number,
): GameEngineResult {
  const displayName = sanitizeName(command.displayName);
  const existing = state.players[command.actorId];
  if (existing) {
    const next = touch(
      {
        ...state,
        players: {
          ...state.players,
          [command.actorId]: {
            ...existing,
            displayName: displayName || existing.displayName,
            connected: true,
            emoji: command.emoji ?? existing.emoji,
            color: command.color ?? existing.color,
            spectator: command.spectator ?? existing.spectator,
          },
        },
      },
      now,
    );
    return {
      state: next,
      events: [
        {
          type: "player-joined",
          playerId: command.actorId,
          displayName: next.players[command.actorId].displayName,
          rejoined: true,
        },
      ],
    };
  }

  if (Object.keys(state.players).length >= maxPlayersPerRoom) {
    return reject(state, command, "room-full", "This room is full.");
  }

  const player: GamePlayer = {
    id: command.actorId,
    displayName: displayName || "Player",
    kind: "human",
    connected: true,
    spectator: Boolean(command.spectator),
    emoji: command.emoji,
    color: command.color,
    joinedAt: now,
  };
  const next = touch(
    {
      ...state,
      players: { ...state.players, [player.id]: player },
      scores: { ...state.scores, [player.id]: state.scores[player.id] ?? 0 },
      // First human through the door owns the room.
      settings: state.settings.hostId
        ? state.settings
        : { ...state.settings, hostId: player.id },
      pickerId:
        state.pickerId ??
        (state.round === "lobby" || state.round === "complete" ? undefined : player.id),
    },
    now,
  );
  return {
    state: next,
    events: [
      {
        type: "player-joined",
        playerId: player.id,
        displayName: player.displayName,
        rejoined: false,
      },
    ],
  };
}

function leaveGame(
  state: GameState,
  command: Extract<GameCommand, { type: "leave-game" }>,
  now: number,
): GameEngineResult {
  const targetId = command.targetPlayerId ?? command.actorId;
  if (targetId !== command.actorId && !isHostOrOpenRoom(state, command.actorId)) {
    return reject(state, command, "not-authorized", "Only the host can remove players.");
  }
  const player = state.players[targetId];
  if (!player) {
    return reject(state, command, "not-found", "Player was not found.");
  }

  const players = { ...state.players };
  const scores = { ...state.scores };
  delete players[targetId];
  delete scores[targetId];

  const next = touch(
    reassignRoles(
      {
        ...state,
        players,
        scores,
        activeClue: state.activeClue
          ? withoutPlayer(state.activeClue, targetId)
          : undefined,
      },
      targetId,
    ),
    now,
  );
  return { state: next, events: [{ type: "player-left", playerId: targetId }] };
}

function setPlayerProfile(
  state: GameState,
  command: Extract<GameCommand, { type: "set-player-profile" }>,
  now: number,
): GameEngineResult {
  const targetId = command.targetPlayerId ?? command.actorId;
  if (targetId !== command.actorId && !isHostOrOpenRoom(state, command.actorId)) {
    return reject(state, command, "not-authorized", "Only the host can edit other players.");
  }
  const player = state.players[targetId];
  if (!player) {
    return reject(state, command, "not-found", "Player was not found.");
  }
  const displayName =
    command.displayName === undefined
      ? player.displayName
      : sanitizeName(command.displayName) || player.displayName;

  return {
    state: touch(
      {
        ...state,
        players: {
          ...state.players,
          [targetId]: {
            ...player,
            displayName,
            emoji: command.emoji ?? player.emoji,
            color: command.color ?? player.color,
            spectator: command.spectator ?? player.spectator,
          },
        },
      },
      now,
    ),
    events: [{ type: "player-updated", playerId: targetId }],
  };
}

function loadGame(
  state: GameState,
  command: Extract<GameCommand, { type: "load-game" }>,
  now: number,
): GameEngineResult {
  if (!isHostOrOpenRoom(state, command.actorId)) {
    return reject(state, command, "not-authorized", "Only the host can load a game.");
  }
  if (command.clues.length === 0) {
    return reject(state, command, "invalid-command", "A game needs at least one clue.");
  }

  const cluesById: Record<string, GameClue> = {};
  const clueIdsByRound: Record<PlayableRound, string[]> = {
    jeopardy: [],
    "double-jeopardy": [],
    "triple-jeopardy": [],
    "final-jeopardy": [],
  };
  for (const clue of command.clues) {
    if (cluesById[clue.id]) {
      return reject(state, command, "invalid-command", `Duplicate clue id: ${clue.id}`);
    }
    cluesById[clue.id] = { ...clue };
    clueIdsByRound[clue.round].push(clue.id);
  }

  const scores = command.keepScores
    ? { ...state.scores }
    : Object.fromEntries(Object.keys(state.players).map((id) => [id, 0]));

  return {
    state: touch(
      {
        ...state,
        round: "lobby",
        roundIntroEndsAt: undefined,
        activeClue: undefined,
        revealedClueIds: [],
        cluesById,
        clueIdsByRound,
        scores,
        stats: createEmptyStats(),
        undoSnapshot: undefined,
      },
      now,
    ),
    events: [{ type: "game-loaded", clueCount: command.clues.length }],
  };
}

/**
 * Time-driven half of the engine. Rooms call this on a timer so windows
 * expire, finished clues close and rounds roll over even when no player
 * touches anything. Returns the identical state object when nothing is due,
 * so callers can skip broadcasting with a reference check.
 */
export function tickGame(state: GameState, now: number): GameEngineResult {
  const events: GameEvent[] = [];
  let next = state;

  if (next.roundIntroEndsAt !== undefined && now >= next.roundIntroEndsAt) {
    next = touch({ ...next, roundIntroEndsAt: undefined }, now);
  }

  const active = next.activeClue;
  if (active) {
    if (
      active.waitingForWager.length > 0 &&
      active.wagerWindowEndsAt !== undefined &&
      now >= active.wagerWindowEndsAt
    ) {
      // Nobody wagered in time — stake the house minimum and read the clue.
      const draft = clone(next);
      const draftActive = draft.activeClue!;
      for (const playerId of [...draftActive.waitingForWager]) {
        const amount = clampWager(
          draftActive.round === "final-jeopardy"
            ? 0
            : draft.cluesById[draftActive.clueId].value,
          draft.round,
          draft.scores[playerId] ?? 0,
        );
        draftActive.wagers[playerId] = amount;
        events.push({
          type: "wager-submitted",
          clueId: draftActive.clueId,
          actorId: playerId,
          amount,
        });
      }
      draftActive.waitingForWager = [];
      const timeout =
        draftActive.round === "final-jeopardy"
          ? draft.settings.finalTimeoutMs
          : draft.settings.answerTimeoutMs;
      revealActiveClue(draftActive, timeout, now, draft);
      events.push({
        type: "clue-revealed",
        clueId: draftActive.clueId,
        readoutEndsAt: draftActive.readoutEndsAt ?? now,
        answerWindowEndsAt: draftActive.answerWindowEndsAt ?? now,
      });
      next = touch(draft, now);
    }
  }

  const live = next.activeClue;
  if (live && live.clueRevealed && !live.answerRevealed) {
    const buzzedIds = Object.keys(live.buzzes);
    const outstanding = buzzedIds.filter((id) => !live.submitted[id]);
    const answerExpired =
      live.answerWindowEndsAt !== undefined && now >= live.answerWindowEndsAt;
    const buzzExpired =
      buzzedIds.length === 0 &&
      live.buzzWindowEndsAt !== undefined &&
      now >= live.buzzWindowEndsAt;

    if (buzzExpired) {
      events.push({ type: "buzz-window-closed", clueId: live.clueId });
      const revealed = revealAnswer(next, { type: "reveal-answer" }, now);
      next = revealed.state;
      if (next.activeClue) {
        next = touch({ ...next, activeClue: { ...next.activeClue, timedOut: true } }, now);
      }
      events.push(...revealed.events);
    } else if (answerExpired && (outstanding.length > 0 || buzzedIds.length > 0)) {
      for (const playerId of outstanding) {
        events.push({ type: "answer-timed-out", clueId: live.clueId, playerId });
      }
      const revealed = revealAnswer(next, { type: "reveal-answer" }, now);
      next = revealed.state;
      events.push(...revealed.events);
    }
  }

  const finishing = next.activeClue;
  if (finishing?.canAdvance) {
    if (finishing.closesAt === undefined && next.settings.autoAdvanceMs > 0) {
      next = touch(
        {
          ...next,
          activeClue: { ...finishing, closesAt: now + next.settings.autoAdvanceMs },
        },
        now,
      );
    } else if (finishing.closesAt !== undefined && now >= finishing.closesAt) {
      const completed = skip(next, { type: "skip" }, now);
      next = completed.state;
      events.push(...completed.events);
    }
  }

  return { state: next, events };
}

function withoutPlayer(active: ActiveClueState, playerId: string): ActiveClueState {
  const stripped: ActiveClueState = clone(active);
  delete stripped.buzzes[playerId];
  delete stripped.answers[playerId];
  delete stripped.submitted[playerId];
  delete stripped.wagers[playerId];
  delete stripped.judges[playerId];
  delete stripped.lockouts[playerId];
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
 * Hands the host badge and the picker seat to someone still in the room.
 * Called when a player leaves or drops off the connection.
 */
export function reassignRoles(state: GameState, departedId: string): GameState {
  let settings = state.settings;
  let pickerId = state.pickerId;

  if (settings.hostId === departedId) {
    settings = { ...settings, hostId: nextHostId(state, departedId) };
  }
  if (pickerId === departedId) {
    pickerId =
      settings.hostId ??
      getActivePlayers(state).find((player) => player.id !== departedId)?.id;
  }
  return { ...state, settings, pickerId };
}

function nextHostId(state: GameState, departedId: string): string | undefined {
  const candidates = Object.values(state.players)
    .filter(
      (player) =>
        player.id !== departedId && player.kind === "human" && player.connected,
    )
    .sort(
      (a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0) || a.id.localeCompare(b.id),
    );
  return candidates[0]?.id;
}

function sanitizeName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, 24);
}

function introDeadline(state: GameState, now: number): number | undefined {
  return state.settings.roundIntroMs > 0
    ? now + state.settings.roundIntroMs
    : undefined;
}

function createActiveClue(clue: GameClue): ActiveClueState {
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

function revealActiveClue(
  activeClue: ActiveClueState,
  answerTimeoutMs: number,
  now: number,
  state: GameState,
) {
  activeClue.clueRevealed = true;
  const clue = state.cluesById[activeClue.clueId];
  // Readout window = base lockout + per-char scaling (so long clues aren't
  // cut off and short ones don't drag). Tests leave readoutPerCharMs at 0.
  const estimatedSpeechMs =
    state.settings.buzzUnlockDelayMs +
    clue.clue.length * state.settings.readoutPerCharMs;
  activeClue.readoutEndsAt = now + estimatedSpeechMs;
  activeClue.buzzWindowEndsAt =
    activeClue.readoutEndsAt + state.settings.buzzWindowMs;
  // No active answer deadline until someone buzzes (or Daily Double / Final).
  activeClue.answerWindowEndsAt = undefined;
  activeClue.wagerWindowEndsAt = undefined;

  if (activeClue.dailyDoublePlayerId) {
    activeClue.buzzes[activeClue.dailyDoublePlayerId] = activeClue.readoutEndsAt;
    activeClue.answerWindowEndsAt = activeClue.readoutEndsAt + answerTimeoutMs;
    activeClue.buzzWindowEndsAt = activeClue.readoutEndsAt;
  }

  if (activeClue.round === "final-jeopardy") {
    for (const player of getActivePlayers(state)) {
      activeClue.buzzes[player.id] = activeClue.readoutEndsAt;
    }
    activeClue.answerWindowEndsAt = activeClue.readoutEndsAt + answerTimeoutMs;
    activeClue.buzzWindowEndsAt = activeClue.readoutEndsAt;
  }
}

function advanceToNextRound(
  state: GameState,
  now: number,
): { state: GameState; events: GameEvent[] } {
  const nextRound = getNextRoundWithClues(state, state.round);
  if (!nextRound) {
    state.round = "complete";
    state.pickerId = undefined;
    return { state: touch(state, now), events: [{ type: "round-advanced", round: "complete" }] };
  }

  state.round = nextRound;
  state.pickerId = nextRound === "final-jeopardy" ? undefined : selectPicker(state);
  state.roundIntroEndsAt = introDeadline(state, now);

  if (nextRound === "final-jeopardy") {
    const finalClueId = state.clueIdsByRound["final-jeopardy"].find(
      (clueId) => !state.revealedClueIds.includes(clueId),
    );
    if (finalClueId) {
      const activeClue = createActiveClue(state.cluesById[finalClueId]);
      activeClue.waitingForWager = getActivePlayers(state).map((player) => player.id);
      activeClue.wagerWindowEndsAt =
        now + state.settings.roundIntroMs + state.settings.finalTimeoutMs;
      state.activeClue = activeClue;
      return {
        state: touch(state, now),
        events: [
          { type: "round-advanced", round: nextRound },
          {
            type: "wager-requested",
            clueId: finalClueId,
            playerIds: [...activeClue.waitingForWager],
            deadline: activeClue.wagerWindowEndsAt,
          },
        ],
      };
    }
  }

  return { state: touch(state, now), events: [{ type: "round-advanced", round: nextRound }] };
}

function getFirstPlayableRound(state: GameState): PlayableRound | undefined {
  return playableRounds.find((round) => state.clueIdsByRound[round].length > 0);
}

function getNextRoundWithClues(
  state: GameState,
  currentRound: GameRound,
): PlayableRound | undefined {
  const currentIndex = gameRoundOrder.indexOf(currentRound);
  return playableRounds.find((round) => {
    const roundIndex = gameRoundOrder.indexOf(round);
    return (
      roundIndex > currentIndex &&
      state.clueIdsByRound[round].some(
        (clueId) => !state.revealedClueIds.includes(clueId),
      )
    );
  });
}

function isRoundComplete(state: GameState, round: GameRound) {
  if (round === "lobby" || round === "complete") {
    return false;
  }
  return state.clueIdsByRound[round].every((clueId) =>
    state.revealedClueIds.includes(clueId),
  );
}

function getBoardForRound(state: GameState, round: GameRound): GameClue[] {
  if (round === "lobby" || round === "complete") {
    return [];
  }
  return state.clueIdsByRound[round].map((clueId) => state.cluesById[clueId]);
}

function toPublicBoardClue(state: GameState, clue: GameClue): PublicBoardClue {
  const revealed = state.revealedClueIds.includes(clue.id);
  return {
    id: clue.id,
    category: clue.category,
    value: clue.value,
    revealed,
    clue: revealed ? clue.clue : undefined,
  };
}

function toPublicActiveClue(
  state: GameState,
  active: ActiveClueState,
  now: number,
): PublicActiveClueState {
  const clue = state.cluesById[active.clueId];
  return {
    clueId: active.clueId,
    round: active.round,
    category: clue.category,
    value: clue.value,
    clue: active.clueRevealed ? clue.clue : undefined,
    correctResponse: active.answerRevealed ? clue.correctResponse : undefined,
    dailyDouble: active.dailyDouble,
    dailyDoublePlayerId: active.dailyDoublePlayerId,
    readoutEndsAt: active.readoutEndsAt,
    buzzWindowEndsAt: active.buzzWindowEndsAt,
    answerWindowEndsAt: active.answerWindowEndsAt,
    wagerWindowEndsAt: active.wagerWindowEndsAt,
    waitingForWager: [...active.waitingForWager],
    canBuzz: canBuzz(active, now),
    buzzes: { ...active.buzzes },
    submitted: { ...active.submitted },
    answers: active.answerRevealed ? { ...active.answers } : {},
    wagers: active.answerRevealed ? { ...active.wagers } : {},
    judges: { ...active.judges },
    currentJudgePlayerId: active.currentJudgePlayerId,
    canAdvance: active.canAdvance,
    lockouts: { ...active.lockouts },
    closesAt: active.closesAt,
    timedOut: active.timedOut,
  };
}

function canBuzz(active: ActiveClueState, now: number) {
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

function canSubmitAnswer(active: ActiveClueState, playerId: string, now: number) {
  return (
    active.clueRevealed &&
    !active.answerRevealed &&
    active.waitingForWager.length === 0 &&
    active.buzzes[playerId] !== undefined &&
    now <= (active.answerWindowEndsAt ?? Number.NEGATIVE_INFINITY)
  );
}

function clampWager(amount: number, round: GameRound, score: number) {
  const min = round === "final-jeopardy" ? 0 : 5;
  const roundMinimum =
    round === "jeopardy"
      ? 1_000
      : round === "double-jeopardy"
        ? 2_000
        : round === "triple-jeopardy"
          ? 3_000
          : 0;
  const max = Math.max(score, roundMinimum);
  const safeAmount = Number.isFinite(amount) ? Math.trunc(amount) : min;
  return Math.min(Math.max(safeAmount, min), max);
}

function selectPicker(state: GameState) {
  const hostId = state.settings.hostId;
  // A host at a lectern keeps the board; a host who only runs the game hands
  // the pick to a contestant, lowest score first the way a round opens.
  if (hostId && state.players[hostId] && !state.players[hostId].spectator) {
    return hostId;
  }
  const activePlayers = getActivePlayers(state);
  return activePlayers
    .map((player) => ({ id: player.id, score: state.scores[player.id] ?? 0 }))
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))[0]?.id;
}

function getActivePlayers(state: GameState) {
  return Object.values(state.players).filter((player) => !player.spectator);
}

function remainingActivePlayers(
  state: GameState,
  active: ActiveClueState,
) {
  return getActivePlayers(state).filter(
    (player) => active.judges[player.id] === undefined,
  );
}

function requireActivePlayer(
  state: GameState,
  actorId: string,
  command: GameCommand,
): GameEngineResult | undefined {
  const player = state.players[actorId];
  if (!player || player.spectator) {
    return reject(state, command, "not-active-player", "Actor is not an active player.");
  }
  return undefined;
}

function isHostOrOpenRoom(state: GameState, actorId: string) {
  return !state.settings.hostId || state.settings.hostId === actorId;
}

function isHostOrPicker(state: GameState, actorId: string) {
  return state.settings.hostId === actorId || state.pickerId === actorId;
}

function reject(
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

function incrementStatFor(playerId: string, record: Record<string, number>) {
  record[playerId] = (record[playerId] ?? 0) + 1;
}

function incrementedRecord(record: Record<string, number>, playerId: string) {
  return {
    ...record,
    [playerId]: (record[playerId] ?? 0) + 1,
  };
}

function snapshotState(state: GameState): GameStateSnapshot {
  const snapshot = clone(state);
  delete snapshot.undoSnapshot;
  return snapshot;
}

function touch<T extends GameState>(state: T, now: number): T {
  return {
    ...state,
    updatedAt: now,
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
