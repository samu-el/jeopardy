/**
 * A clue's life, from the moment it is picked to the moment it leaves the
 * board: wager, readout, ring-in, answer, reveal, ruling.
 *
 * Every handler here has the same shape — list the rules the command has to
 * satisfy, then edit a copy of the position and say what happened.
 */
import type {
  ActiveClueState,
  GameCommand,
  GameEngineResult,
  GameEvent,
  GameState,
} from "./contracts";
import {
  advanceToNextRound,
  answerTimeoutFor,
  bumpStat,
  canBuzz,
  canSubmitAnswer,
  clampWager,
  createActiveClue,
  edit,
  editClue,
  isActivePlayer,
  isHostOrOpenRoom,
  isHostOrPicker,
  isRoundComplete,
  maxReadoutHoldMs,
  reboundPossible,
  refuse,
  revealActiveClue,
  snapshotState,
  wagerLimitsFor,
} from "./rules";

type Command<T extends GameCommand["type"]> = Extract<GameCommand, { type: T }>;

/** The event every reveal announces, so the four places that reveal agree. */
function clueRevealedEvent(active: ActiveClueState, now: number): GameEvent {
  return {
    type: "clue-revealed",
    clueId: active.clueId,
    readoutEndsAt: active.readoutEndsAt ?? now,
    answerWindowEndsAt: active.answerWindowEndsAt ?? now,
  };
}

export function pickClue(
  state: GameState,
  command: Command<"pick-clue">,
  now: number,
): GameEngineResult {
  const clue = state.cluesById[command.clueId];
  // A host who isn't playing still runs the board, so only non-host
  // spectators are turned away here.
  const seated = state.settings.hostId === command.actorId || isActivePlayer(state, command.actorId);
  const denied = refuse(state, command, [
    [seated, "not-active-player", "Actor is not an active player."],
    [
      state.round !== "lobby" && state.round !== "complete",
      "game-not-started",
      "Game is not in a playable round.",
    ],
    [!state.activeClue, "clue-already-active", "A clue is already active."],
    [
      !state.roundIntroEndsAt || now >= state.roundIntroEndsAt,
      "cannot-advance",
      "The round is still being introduced.",
    ],
    [
      isHostOrPicker(state, command.actorId),
      "not-current-picker",
      "Only the current picker or host can choose a clue.",
    ],
    [clue, "not-found", "Clue was not found."],
    [clue?.round === state.round, "clue-not-in-round", "Clue is not in this round."],
    [
      !state.revealedClueIds.includes(command.clueId),
      "clue-already-revealed",
      "Clue was already played.",
    ],
  ]);
  if (denied) return denied;

  return edit(state, now, (draft) => {
    const active = createActiveClue(clue);
    draft.activeClue = active;
    draft.stats.questionsStarted += 1;
    const events: GameEvent[] = [
      {
        type: "clue-picked",
        clueId: clue.id,
        actorId: command.actorId,
        dailyDouble: Boolean(clue.dailyDouble),
      },
    ];

    // A Daily Double belongs to whoever found it: they wager alone, and the
    // clue waits for that number before anybody sees it.
    if (clue.dailyDouble && !draft.settings.allowMultipleCorrect) {
      active.dailyDoublePlayerId = command.actorId;
      active.waitingForWager = [command.actorId];
      active.wagerWindowStartsAt = now;
      active.wagerWindowEndsAt = now + draft.settings.wagerTimeoutMs;
      bumpStat(draft.stats.dailyDoublesByPlayer, command.actorId);
      events.push({
        type: "wager-requested",
        clueId: clue.id,
        playerIds: [command.actorId],
        deadline: active.wagerWindowEndsAt,
      });
      return events;
    }

    revealActiveClue(active, draft.settings.answerTimeoutMs, now, draft);
    events.push(clueRevealedEvent(active, now));
    return events;
  });
}

export function submitWager(
  state: GameState,
  command: Command<"submit-wager">,
  now: number,
): GameEngineResult {
  const denied = refuse(state, command, [
    [
      state.activeClue?.waitingForWager.includes(command.actorId),
      "wager-not-open",
      "No wager is open for this player.",
    ],
    [isActivePlayer(state, command.actorId), "not-active-player", "Actor is not an active player."],
  ]);
  if (denied) return denied;

  return editClue(state, now, (active, draft) => {
    const limits = wagerLimitsFor(draft, command.actorId, active.round);
    const { amount, adjusted } = clampWager(command.amount, limits);
    active.wagers[command.actorId] = amount;
    active.waitingForWager = active.waitingForWager.filter((id) => id !== command.actorId);
    const events: GameEvent[] = [
      {
        type: "wager-submitted",
        clueId: active.clueId,
        actorId: command.actorId,
        amount,
        ...(adjusted ? { requestedAmount: command.amount, adjusted } : {}),
        min: limits.min,
        max: limits.max,
      },
    ];

    // The last wager in puts the clue on the board.
    if (active.waitingForWager.length === 0) {
      revealActiveClue(active, answerTimeoutFor(draft, active.round), now, draft);
      events.push(clueRevealedEvent(active, now));
    }
    return events;
  });
}

/**
 * The host's voice stopped: open the buzzer now instead of at the estimate.
 * A clue with no ring-in window, or one already past it, simply ignores this.
 */
export function readoutComplete(
  state: GameState,
  command: Command<"readout-complete">,
  now: number,
): GameEngineResult {
  const active = state.activeClue;
  const denied = refuse(state, command, [
    [active?.clueId === command.clueId, "not-found", "Clue is not active."],
    [
      isHostOrOpenRoom(state, command.actorId),
      "not-authorized",
      "Only the host can mark the readout complete.",
    ],
  ]);
  if (denied) return denied;
  if (!hasRingInWindow(active!) || now >= (active!.readoutEndsAt ?? 0)) {
    return { state, events: [] };
  }

  return editClue(state, now, (clue, draft) => {
    clue.readoutEndsAt = now;
    clue.buzzWindowEndsAt = now + draft.settings.buzzWindowMs;
  });
}

/** The host is still reading: hold the buzzer shut a little longer. */
export function extendReadout(
  state: GameState,
  command: Command<"extend-readout">,
  now: number,
): GameEngineResult {
  const active = state.activeClue;
  const denied = refuse(state, command, [
    [active?.clueId === command.clueId, "not-found", "Clue is not active."],
    [isHostOrOpenRoom(state, command.actorId), "not-authorized", "Only the host paces the readout."],
  ]);
  if (denied) return denied;

  const endsAt = Math.min(command.endsAt, now + maxReadoutHoldMs);
  const holdable =
    hasRingInWindow(active!) &&
    active!.clueRevealed &&
    !active!.answerRevealed &&
    // Only ever later: bringing the window forward is `readout-complete`'s job.
    endsAt > (active!.readoutEndsAt ?? now);
  if (!holdable) return { state, events: [] };

  return editClue(state, now, (clue, draft) => {
    clue.readoutEndsAt = endsAt;
    clue.buzzWindowEndsAt = endsAt + draft.settings.buzzWindowMs;
  });
}

/** Wagered clues and Final are owed by name; nobody rings in for them. */
function hasRingInWindow(active: ActiveClueState): boolean {
  return (
    !active.dailyDoublePlayerId &&
    active.round !== "final-jeopardy" &&
    Object.keys(active.buzzes).length === 0
  );
}

export function buzz(
  state: GameState,
  command: Command<"buzz">,
  now: number,
): GameEngineResult {
  const active = state.activeClue;
  const denied = refuse(state, command, [
    [
      active?.clueRevealed && !active.answerRevealed,
      "buzz-not-open",
      "Buzzing is not open.",
    ],
    [isActivePlayer(state, command.actorId), "not-active-player", "Actor is not an active player."],
    [
      now >= (active?.lockouts[command.actorId] ?? 0),
      "buzz-locked-out",
      "Buzzer is locked out.",
    ],
  ]);
  if (denied) return denied;

  // Rang in before the host finished reading: the show penalises this with a
  // short lockout rather than an outright rejection.
  const early =
    state.settings.earlyBuzzLockoutMs > 0 &&
    active!.readoutEndsAt !== undefined &&
    now < active!.readoutEndsAt &&
    hasRingInWindow(active!) &&
    active!.waitingForWager.length === 0 &&
    active!.judges[command.actorId] === undefined;
  if (early) {
    return editClue(state, now, (clue) => {
      const until = now + state.settings.earlyBuzzLockoutMs;
      clue.lockouts[command.actorId] = until;
      return [{ type: "buzz-locked-out", clueId: clue.clueId, actorId: command.actorId, until }];
    });
  }

  const tooLate = refuse(state, command, [
    [canBuzz(active!, now), "buzz-not-open", "Buzzing is locked."],
    [active!.buzzes[command.actorId] === undefined, "already-buzzed", "Player already buzzed."],
    [active!.judges[command.actorId] === undefined, "already-buzzed", "Player was already judged."],
  ]);
  if (tooLate) return tooLate;

  return editClue(state, now, (clue, draft) => {
    const reactionTimeMs = now - (clue.readoutEndsAt ?? now);
    if (Object.keys(clue.buzzes).length === 0) {
      bumpStat(draft.stats.firstBuzzByPlayer, command.actorId);
    }
    clue.buzzes[command.actorId] = now;
    // Buzzing closes the ring-in window and starts the answer deadline.
    clue.buzzWindowEndsAt = now;
    clue.answerWindowEndsAt = now + draft.settings.answerTimeoutMs;
    draft.stats.reactionTimesByPlayer[command.actorId] = [
      ...(draft.stats.reactionTimesByPlayer[command.actorId] ?? []),
      reactionTimeMs,
    ];
    return [
      {
        type: "buzz-accepted",
        clueId: clue.clueId,
        actorId: command.actorId,
        buzzedAt: now,
        reactionTimeMs,
      },
    ];
  });
}

export function submitAnswer(
  state: GameState,
  command: Command<"submit-answer">,
  now: number,
): GameEngineResult {
  const active = state.activeClue;
  const denied = refuse(state, command, [
    [active?.clueRevealed && !active.answerRevealed, "answer-not-open", "Answering is not open."],
    [isActivePlayer(state, command.actorId), "not-active-player", "Actor is not an active player."],
    [
      canSubmitAnswer(active!, command.actorId, now),
      "answer-not-open",
      "Player cannot submit now.",
    ],
    [!active!.submitted[command.actorId], "already-submitted", "Player already submitted."],
  ]);
  if (denied) return denied;

  const written = editClue(state, now, (clue, draft) => {
    clue.answers[command.actorId] = command.answer;
    clue.submitted[command.actorId] = true;
    bumpStat(draft.stats.answeredByPlayer, command.actorId);
    return [
      {
        type: "answer-submitted",
        clueId: clue.clueId,
        actorId: command.actorId,
        hasAnswer: command.answer.trim().length > 0,
      },
    ];
  });

  // Everyone who owes an answer has given one — the one player who rang in,
  // the Daily Double picker, or the whole table in Final — so the clock has
  // nothing left to wait for. Reveal now rather than when the answer window
  // would have run out: those seconds were dead air for the whole room.
  const clue = written.state.activeClue!;
  const owing = Object.keys(clue.buzzes).some((id) => !clue.submitted[id]);
  if (owing) return written;

  const revealed = revealAnswer(written.state, { type: "reveal-answer" }, now);
  return { state: revealed.state, events: [...written.events, ...revealed.events] };
}

export function revealAnswer(
  state: GameState,
  command: Command<"reveal-answer">,
  now: number,
): GameEngineResult {
  const active = state.activeClue;
  const denied = refuse(state, command, [
    [
      active?.clueRevealed && !active.answerRevealed,
      "answer-not-open",
      "No answer can be revealed.",
    ],
    [
      !command.actorId || isHostOrOpenRoom(state, command.actorId),
      "not-authorized",
      "Only the host can reveal.",
    ],
  ]);
  if (denied) return denied;

  const snapshot = snapshotState(state);
  return editClue(state, now, (clue, draft) => {
    // Anyone who rang in and never sent anything is judged on their silence.
    for (const playerId of Object.keys(clue.buzzes)) {
      if (clue.answers[playerId] !== undefined) continue;
      clue.answers[playerId] = "";
      clue.submitted[playerId] = true;
      bumpStat(draft.stats.answeredByPlayer, playerId);
    }
    clue.answerRevealed = true;
    // Ring-in order everywhere except Final Jeopardy, which the show reveals
    // from the lowest score up. A player already ruled wrong keeps their
    // answer on the record but is not judged twice.
    clue.judgeQueue = Object.keys(clue.answers)
      .filter((id) => clue.judges[id] === undefined)
      .sort((a, b) =>
      clue.round === "final-jeopardy"
        ? (draft.scores[a] ?? 0) - (draft.scores[b] ?? 0) || a.localeCompare(b)
        : (clue.buzzes[a] ?? 0) - (clue.buzzes[b] ?? 0),
    );
    clue.currentJudgePlayerId = clue.judgeQueue[0];
    clue.canAdvance = clue.judgeQueue.length === 0;
    draft.undoSnapshot = snapshot;
    return [
      { type: "answer-revealed", clueId: clue.clueId, judgeQueue: [...clue.judgeQueue] },
    ];
  });
}

export function judgeAnswer(
  state: GameState,
  command: Command<"judge-answer">,
  now: number,
): GameEngineResult {
  const active = state.activeClue;
  const denied = refuse(state, command, [
    [active?.answerRevealed, "answer-not-revealed", "Answer is not revealed."],
    [isHostOrOpenRoom(state, command.actorId), "not-authorized", "Only the host can judge."],
    [
      active!.judges[command.targetPlayerId] === undefined,
      "already-judged",
      "Player was already judged.",
    ],
    [
      !active!.currentJudgePlayerId || active!.currentJudgePlayerId === command.targetPlayerId,
      "invalid-command",
      "Judge queue is out of order.",
    ],
  ]);
  if (denied) return denied;

  // Every ruling can be taken back: a host who (or an AI judge that) got it
  // wrong sends `undo` and is back to this exact moment.
  const snapshot = snapshotState(state);
  return editClue(state, now, (clue, draft) => {
    draft.undoSnapshot = snapshot;
    const target = command.targetPlayerId;
    const stake = clue.wagers[target] ?? draft.cluesById[clue.clueId].value;
    const delta = command.correct === true ? stake : command.correct === false ? -stake : 0;
    clue.judges[target] = command.correct;
    draft.scores[target] = (draft.scores[target] ?? 0) + delta;

    if (command.correct === true) {
      bumpStat(draft.stats.correctByPlayer, target);
      // Right answer takes the board — except in Final, where nothing is left
      // to pick, and in rooms that let everyone answer the same clue.
      if (!draft.settings.allowMultipleCorrect && draft.round !== "final-jeopardy") {
        draft.pickerId = target;
        clue.canAdvance = true;
      }
    }
    if (command.correct === false) {
      bumpStat(draft.stats.incorrectByPlayer, target);
      // Clear the wrong player's ring-in so the rest of the table can try.
      // They stay locked out of this clue through the `judges` book, and
      // their answer stays on the record so the table can see what was said.
      if (draft.round !== "final-jeopardy") {
        delete clue.buzzes[target];
        clue.judgeQueue = clue.judgeQueue.filter((id) => id !== target);
      }
    }

    if (!clue.canAdvance) {
      clue.currentJudgePlayerId = clue.judgeQueue.find(
        (playerId) => clue.judges[playerId] === undefined,
      );
      // Whether anyone else gets a go depends only on who is left — never on
      // how long the host took to rule. A Daily Double belongs to its picker
      // alone, so a miss there simply ends the clue.
      const reopens =
        !clue.currentJudgePlayerId &&
        command.correct === false &&
        reboundPossible(draft, clue);
      if (reopens) {
        // The response was never shown (see `isResponsePublic`), so the rest
        // of the table can ring in fairly.
        clue.answerRevealed = false;
        clue.buzzWindowEndsAt = now + draft.settings.buzzWindowMs;
        clue.answerWindowEndsAt = undefined;
        clue.reboundOpenedAt = now;
      } else {
        clue.canAdvance = !clue.currentJudgePlayerId;
      }
    }

    const events: GameEvent[] = [
      {
        type: "answer-judged",
        clueId: clue.clueId,
        actorId: command.actorId,
        targetPlayerId: target,
        correct: command.correct,
        delta,
      },
    ];
    if (delta !== 0) {
      events.push({
        type: "score-changed",
        playerId: target,
        score: draft.scores[target] ?? 0,
        delta,
      });
    }
    return events;
  });
}

/** Takes the finished clue off the board, and rolls the round over if it was the last. */
export function skip(
  state: GameState,
  command: Command<"skip">,
  now: number,
): GameEngineResult {
  const active = state.activeClue;
  const denied = refuse(state, command, [
    [
      !command.actorId || isHostOrOpenRoom(state, command.actorId),
      "not-authorized",
      "Only the host can skip.",
    ],
    [
      active && (active.canAdvance || active.answerRevealed),
      "cannot-advance",
      "Current clue cannot advance.",
    ],
  ]);
  if (denied) return denied;

  return edit(state, now, (draft) => {
    const clueId = active!.clueId;
    if (active!.round === "final-jeopardy") {
      draft.finalJeopardy = {
        clueId,
        entries: finalOrder(active!).map((playerId) => ({
          playerId,
          answer: active!.answers[playerId] ?? "",
          wager: active!.wagers[playerId] ?? 0,
          correct: active!.judges[playerId],
        })),
      };
    }
    draft.revealedClueIds = [...new Set([...draft.revealedClueIds, clueId])];
    draft.activeClue = undefined;
    const events: GameEvent[] = [{ type: "clue-completed", clueId }];
    if (draft.round !== "complete" && isRoundComplete(draft, draft.round)) {
      events.push(...advanceToNextRound(draft, now));
    }
    return events;
  });
}

/** Final's players in reveal order, falling back to wager order before a reveal. */
function finalOrder(active: ActiveClueState): string[] {
  if (active.judgeQueue.length > 0) return [...active.judgeQueue];
  return Object.keys({ ...active.wagers, ...active.answers });
}

/**
 * The time-driven half of the engine. Rooms call this on a timer so windows
 * expire, finished clues close and rounds roll over even when nobody touches
 * anything. Returns the identical state object when nothing is due, so
 * callers can skip broadcasting with a reference check.
 */
export function tickGame(state: GameState, now: number): GameEngineResult {
  const events: GameEvent[] = [];
  let next = state;

  if (next.roundIntroEndsAt !== undefined && now >= next.roundIntroEndsAt) {
    next = { ...next, roundIntroEndsAt: undefined, updatedAt: now };
  }

  const waiting = next.activeClue;
  if (
    waiting?.waitingForWager.length &&
    waiting.wagerWindowEndsAt !== undefined &&
    now >= waiting.wagerWindowEndsAt
  ) {
    // Nobody wagered in time — stake the house minimum and read the clue.
    const forced = editClue(next, now, (clue, draft) => {
      const pending = [...clue.waitingForWager];
      const staked: GameEvent[] = pending.map((playerId) => {
        const limits = wagerLimitsFor(draft, playerId, clue.round);
        const { amount } = clampWager(
          clue.round === "final-jeopardy" ? 0 : draft.cluesById[clue.clueId].value,
          limits,
        );
        clue.wagers[playerId] = amount;
        return {
          type: "wager-submitted",
          clueId: clue.clueId,
          actorId: playerId,
          amount,
          min: limits.min,
          max: limits.max,
        };
      });
      clue.waitingForWager = [];
      revealActiveClue(clue, answerTimeoutFor(draft, clue.round), now, draft);
      return [...staked, clueRevealedEvent(clue, now)];
    });
    next = forced.state;
    events.push(...forced.events);
  }

  const live = next.activeClue;
  if (live?.clueRevealed && !live.answerRevealed) {
    const buzzed = Object.keys(live.buzzes);
    const nobodyRangIn =
      buzzed.length === 0 &&
      live.buzzWindowEndsAt !== undefined &&
      now >= live.buzzWindowEndsAt;
    const answersExpired =
      buzzed.length > 0 &&
      live.answerWindowEndsAt !== undefined &&
      now >= live.answerWindowEndsAt;

    if (nobodyRangIn || answersExpired) {
      if (nobodyRangIn) {
        events.push({ type: "buzz-window-closed", clueId: live.clueId });
      }
      const expired = buzzed.filter((id) => !live.submitted[id]);
      for (const playerId of expired) {
        events.push({ type: "answer-timed-out", clueId: live.clueId, playerId });
      }
      const revealed = revealAnswer(next, { type: "reveal-answer" }, now);
      next = revealed.state;
      if (next.activeClue && (nobodyRangIn || expired.length > 0)) {
        const timedOutClue = { ...next.activeClue };
        if (nobodyRangIn) timedOutClue.timedOut = true;
        if (expired.length > 0) {
          timedOutClue.answerTimedOut = [
            ...new Set([...(timedOutClue.answerTimedOut ?? []), ...expired]),
          ];
        }
        next = { ...next, activeClue: timedOutClue, updatedAt: now };
      }
      events.push(...revealed.events);
    }
  }

  // A clue that has been ruled on waits a beat, then clears itself.
  const finishing = next.activeClue;
  if (finishing?.canAdvance && next.settings.autoAdvanceMs > 0) {
    if (finishing.closesAt === undefined) {
      next = {
        ...next,
        activeClue: { ...finishing, closesAt: now + next.settings.autoAdvanceMs },
        updatedAt: now,
      };
    } else if (now >= finishing.closesAt) {
      const completed = skip(next, { type: "skip" }, now);
      next = completed.state;
      events.push(...completed.events);
    }
  }

  return { state: next, events };
}
