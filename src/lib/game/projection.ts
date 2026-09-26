/**
 * What a client is allowed to see.
 *
 * The room's own state holds the answers to clues nobody has reached yet; a
 * projection is the version safe to put on the wire. Anything still secret —
 * an unrevealed clue's text, an unrevealed correct response, answers and
 * wagers before the reveal — simply isn't in the object that leaves here.
 *
 * The correct response is the subtle one. Answers can be in and a ruling
 * pending while other contestants may still ring in on a rebound, so it goes
 * to the table only once the clue is settled (`isResponsePublic`). The one
 * exception is a host who cannot ring in on this clue any more: they are
 * shown it while ruling, and nobody else is.
 */
import type {
  ActiveClueState,
  GameState,
  PublicActiveClueState,
  PublicBoardClue,
  PublicClueKind,
  PublicCluePhase,
  PublicGameState,
  PublicPlayerState,
  PublicResults,
  WagerLimits,
} from "./contracts";
import {
  canBuzz,
  clone,
  getActivePlayers,
  getBoardForRound,
  getLeaders,
  getStandings,
  getWinners,
  isActivePlayer,
  isResponsePublic,
  seatOrder,
  wagerLimitsFor,
} from "./rules";

export interface ProjectionOptions {
  /**
   * Who the projection is for. Only matters to the host, who may be shown
   * the correct response while ruling; everything else is the same for all.
   */
  viewerId?: string;
}

export function getPublicGameState(
  state: GameState,
  now: number,
  options: ProjectionOptions = {},
): PublicGameState {
  const { allowMultipleCorrect, hostId, voiceProfileId, avatarHostProfileId } = state.settings;
  const { aiJudgeEnabled, aiBotsEnabled, aiAvatarHostEnabled } = state.settings;
  const { autoAdvanceMs, earlyBuzzLockoutMs } = state.settings;
  const contestants = getActivePlayers(state);

  return {
    roomId: state.roomId,
    round: state.round,
    serverTime: now,
    pickerId: state.pickerId,
    players: seatOrder(state).map<PublicPlayerState>((id) => ({
      ...state.players[id],
      score: state.scores[id] ?? 0,
    })),
    standings: getStandings(state),
    audience: {
      contestants: contestants.length,
      spectators: Object.keys(state.players).length - contestants.length,
      connectedContestants: contestants.filter((player) => player.connected).length,
    },
    results: state.round === "complete" ? toPublicResults(state) : undefined,
    board: getBoardForRound(state, state.round).map<PublicBoardClue>((clue) => {
      const revealed = state.revealedClueIds.includes(clue.id);
      return {
        id: clue.id,
        category: clue.category,
        value: clue.value,
        revealed,
        clue: revealed ? clue.clue : undefined,
      };
    }),
    currentClue: state.activeClue
      ? toPublicActiveClue(state, state.activeClue, now, options.viewerId)
      : undefined,
    roundIntroEndsAt: state.roundIntroEndsAt,
    settings: {
      allowMultipleCorrect,
      hostId,
      voiceProfileId,
      avatarHostProfileId,
      aiJudgeEnabled,
      aiBotsEnabled,
      aiAvatarHostEnabled,
      autoAdvanceMs,
      earlyBuzzLockoutMs,
    },
    stats: clone(state.stats),
  };
}

function toPublicResults(state: GameState): PublicResults {
  const record = state.finalJeopardy;
  const finalClue = record ? state.cluesById[record.clueId] : undefined;
  return {
    winners: getWinners(state),
    leaders: getLeaders(state),
    finalJeopardy:
      record && finalClue
        ? {
            ...clone(record),
            category: finalClue.category,
            clue: finalClue.clue,
            correctResponse: finalClue.correctResponse,
          }
        : undefined,
  };
}

/** A host who has no more chance at this clue may read the card while ruling. */
function hostMayPeek(state: GameState, active: ActiveClueState, viewerId?: string): boolean {
  if (!viewerId || viewerId !== state.settings.hostId || !active.answerRevealed) return false;
  if (!isActivePlayer(state, viewerId)) return true;
  return active.judges[viewerId] !== undefined || active.buzzes[viewerId] !== undefined;
}

export function cluePhase(active: ActiveClueState, now: number): PublicCluePhase {
  if (!active.clueRevealed || active.waitingForWager.length > 0) return "wager";
  if (active.answerRevealed) return active.canAdvance ? "resolved" : "judging";
  if (now < (active.readoutEndsAt ?? 0)) return "reading";
  if (Object.keys(active.buzzes).length > 0) return "answering";
  return "buzzing";
}

function clueKind(active: ActiveClueState): PublicClueKind {
  if (active.round === "final-jeopardy") return "final";
  return active.dailyDoublePlayerId ? "daily-double" : "standard";
}

function toPublicActiveClue(
  state: GameState,
  active: ActiveClueState,
  now: number,
  viewerId?: string,
): PublicActiveClueState {
  const clue = state.cluesById[active.clueId];
  // Peeled off rather than sent: the room's bookkeeping, not the table's.
  const { clueRevealed, answerRevealed, judgeQueue, ...open } = active;
  void judgeQueue;
  const responseFinal = isResponsePublic(state, active);
  const phase = cluePhase(active, now);
  const isFinal = active.round === "final-jeopardy";
  // A ruled-on answer is on the record; the rest come out together at the reveal.
  const answers = answerRevealed
    ? { ...active.answers }
    : Object.fromEntries(
        Object.entries(active.answers).filter(([id]) => active.judges[id] !== undefined),
      );
  const wagerLimits: Record<string, WagerLimits> = Object.fromEntries(
    active.waitingForWager.map((id) => [id, wagerLimitsFor(state, id, active.round)]),
  );
  return {
    ...open,
    category: clue.category,
    value: clue.value,
    clue: clueRevealed ? clue.clue : undefined,
    correctResponse:
      responseFinal || hostMayPeek(state, active, viewerId) ? clue.correctResponse : undefined,
    waitingForWager: [...active.waitingForWager],
    canBuzz: canBuzz(active, now),
    kind: clueKind(active),
    phase,
    rebound: phase === "buzzing" && active.reboundOpenedAt !== undefined,
    responseFinal,
    wagerLimits,
    buzzes: { ...active.buzzes },
    submitted: { ...active.submitted },
    answers,
    // A Daily Double wager is announced as soon as it is made, as on the
    // show; Final wagers stay sealed until the answers are revealed.
    wagers: isFinal && !answerRevealed ? {} : { ...active.wagers },
    judges: { ...active.judges },
    lockouts: { ...active.lockouts },
    answerTimedOut: active.answerTimedOut ? [...active.answerTimedOut] : undefined,
  };
}
