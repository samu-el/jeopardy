/**
 * What a client is allowed to see.
 *
 * The room's own state holds the answers to clues nobody has reached yet; a
 * projection is the version safe to put on the wire. Anything still secret —
 * an unrevealed clue's text, an unrevealed correct response, answers and
 * wagers before the reveal — simply isn't in the object that leaves here.
 */
import type {
  ActiveClueState,
  GameState,
  PublicActiveClueState,
  PublicBoardClue,
  PublicGameState,
  PublicPlayerState,
} from "./contracts";
import { canBuzz, clone, getBoardForRound } from "./rules";

export function getPublicGameState(state: GameState, now: number): PublicGameState {
  const { allowMultipleCorrect, hostId, voiceProfileId, avatarHostProfileId } = state.settings;
  const { aiJudgeEnabled, aiBotsEnabled, aiAvatarHostEnabled } = state.settings;
  const { autoAdvanceMs, earlyBuzzLockoutMs } = state.settings;

  return {
    roomId: state.roomId,
    round: state.round,
    serverTime: now,
    pickerId: state.pickerId,
    players: Object.values(state.players)
      .map<PublicPlayerState>((player) => ({ ...player, score: state.scores[player.id] ?? 0 }))
      .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName)),
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
      ? toPublicActiveClue(state, state.activeClue, now)
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

function toPublicActiveClue(
  state: GameState,
  active: ActiveClueState,
  now: number,
): PublicActiveClueState {
  const clue = state.cluesById[active.clueId];
  // Peeled off rather than sent: the room's bookkeeping, not the table's.
  const { clueRevealed, answerRevealed, judgeQueue, ...open } = active;
  void judgeQueue;
  return {
    ...open,
    category: clue.category,
    value: clue.value,
    clue: clueRevealed ? clue.clue : undefined,
    correctResponse: answerRevealed ? clue.correctResponse : undefined,
    waitingForWager: [...active.waitingForWager],
    canBuzz: canBuzz(active, now),
    buzzes: { ...active.buzzes },
    submitted: { ...active.submitted },
    answers: answerRevealed ? { ...active.answers } : {},
    wagers: answerRevealed ? { ...active.wagers } : {},
    judges: { ...active.judges },
    lockouts: { ...active.lockouts },
  };
}
