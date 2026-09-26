/**
 * Final Jeopardy as the room watches it.
 *
 * The show reveals Final from the lowest score up: each contestant's written
 * response, then their verdict, then their wager and the new score. All of it
 * is already public once the correct response is up (the projection opens
 * `answers` and `wagers` at the reveal); this works out the order and the
 * before/after scores from that, so every screen tells the same story.
 *
 * An older room that never sends answers or wagers still gets a sensible
 * phase and an empty reveal rather than a crash.
 */
import type { PublicGameState } from "./contracts";

export type FinalPhase = "wagering" | "answering" | "revealing" | "done";

export interface FinalRevealRow {
  playerId: string;
  displayName: string;
  /** What they wrote. `""` when they wrote nothing; undefined when not sent. */
  answer?: string;
  wager?: number;
  /** true / false once ruled, null for "no ruling", undefined while pending. */
  verdict?: boolean | null;
  scoreBefore: number;
  scoreAfter: number;
  /** The one being revealed right now. */
  current: boolean;
}

export interface FinalReveal {
  phase: FinalPhase;
  category: string;
  clue?: string;
  correctResponse?: string;
  /** Names of contestants who still owe a wager. */
  waitingFor: string[];
  /** When the wager or answer window closes, if the room says. */
  deadline?: number;
  rows: FinalRevealRow[];
}

export function getFinalReveal(state: PublicGameState): FinalReveal | null {
  const clue = state.currentClue;
  if (!clue || clue.round !== "final-jeopardy") return null;

  const byId = new Map(state.players.map((player) => [player.id, player]));
  const nameOf = (id: string) => byId.get(id)?.displayName ?? id;
  const revealed = clue.correctResponse !== undefined;

  const phase: FinalPhase =
    clue.waitingForWager.length > 0
      ? "wagering"
      : !revealed
        ? "answering"
        : clue.currentJudgePlayerId
          ? "revealing"
          : "done";

  const ids = revealed
    ? [...new Set([...Object.keys(clue.answers ?? {}), ...Object.keys(clue.wagers ?? {})])]
    : [];
  const rows = ids
    .filter((id) => !byId.get(id)?.spectator)
    .map<FinalRevealRow>((id) => {
      const wager = clue.wagers?.[id];
      const verdict = clue.judges?.[id];
      const scoreAfter = byId.get(id)?.score ?? 0;
      const delta = verdict === true ? (wager ?? 0) : verdict === false ? -(wager ?? 0) : 0;
      return {
        playerId: id,
        displayName: nameOf(id),
        answer: clue.answers?.[id],
        wager,
        verdict,
        scoreBefore: scoreAfter - delta,
        scoreAfter,
        current: clue.currentJudgePlayerId === id,
      };
    })
    // The engine's judging order: lowest score going in first.
    .sort((a, b) => a.scoreBefore - b.scoreBefore || a.playerId.localeCompare(b.playerId));

  return {
    phase,
    category: clue.category,
    clue: clue.clue,
    correctResponse: clue.correctResponse,
    waitingFor: clue.waitingForWager.map(nameOf),
    deadline:
      phase === "wagering"
        ? clue.wagerWindowEndsAt
        : phase === "answering"
          ? clue.answerWindowEndsAt
          : undefined,
    rows,
  };
}
