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

export const defaultGameSettings: GameSettings = {
  answerTimeoutMs: 8_000,
  buzzWindowMs: 6_000,
  finalTimeoutMs: 30_000,
  buzzUnlockDelayMs: 1_500,
  allowMultipleCorrect: false,
  aiJudgeEnabled: false,
  aiBotsEnabled: false,
  aiAvatarHostEnabled: false,
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
    case "undo":
      return undo(state, command, context.now);
    case "update-settings":
      return updateSettings(state, command, context.now);
    case "add-bot":
      return addBot(state, command, context.now);
    case "configure-host":
      return configureHost(state, command, context.now);
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
    settings: {
      allowMultipleCorrect: state.settings.allowMultipleCorrect,
      hostId: state.settings.hostId,
      voiceProfileId: state.settings.voiceProfileId,
      avatarHostProfileId: state.settings.avatarHostProfileId,
      aiJudgeEnabled: state.settings.aiJudgeEnabled,
      aiBotsEnabled: state.settings.aiBotsEnabled,
      aiAvatarHostEnabled: state.settings.aiAvatarHostEnabled,
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
  const playerCheck = requireActivePlayer(state, command.actorId, command);
  if (playerCheck) {
    return playerCheck;
  }
  if (state.round === "lobby" || state.round === "complete") {
    return reject(state, command, "game-not-started", "Game is not in a playable round.");
  }
  if (state.activeClue) {
    return reject(state, command, "clue-already-active", "A clue is already active.");
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
  nextActive.judgeQueue = Object.keys(nextActive.answers).sort(
    (a, b) => (nextActive.buzzes[a] ?? 0) - (nextActive.buzzes[b] ?? 0),
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
  };
}

function revealActiveClue(
  activeClue: ActiveClueState,
  answerTimeoutMs: number,
  now: number,
  state: GameState,
) {
  activeClue.clueRevealed = true;
  activeClue.readoutEndsAt = now + state.settings.buzzUnlockDelayMs;
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

  if (nextRound === "final-jeopardy") {
    const finalClueId = state.clueIdsByRound["final-jeopardy"].find(
      (clueId) => !state.revealedClueIds.includes(clueId),
    );
    if (finalClueId) {
      const activeClue = createActiveClue(state.cluesById[finalClueId]);
      activeClue.waitingForWager = getActivePlayers(state).map((player) => player.id);
      activeClue.wagerWindowEndsAt = now + state.settings.finalTimeoutMs;
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
  if (state.settings.hostId) {
    return state.settings.hostId;
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
