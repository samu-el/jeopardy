/**
 * Final Jeopardy as the room watches it.
 *
 * The show reveals Final from the lowest score up: each contestant's written
 * response, then the ruling, then the wager and the new score. While the
 * clue is live that comes from `currentClue` (answers and wagers are public
 * once the phase reaches judging); after the game it comes from
 * `results.finalJeopardy`, which the room keeps in reveal order. Either way
 * this works out the before/after scores, so every screen tells the same
 * story.
 *
 * A snapshot with no answers or wagers still gets a sensible phase and an
 * empty reveal rather than a crash.
 */
import type { PublicCluePhase, PublicGameState } from "./contracts";

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

const phases: Record<PublicCluePhase, FinalPhase> = {
  wager: "wagering",
  reading: "answering",
  buzzing: "answering",
  answering: "answering",
  judging: "revealing",
  resolved: "done",
};

function row(
  state: PublicGameState,
  playerId: string,
  entry: { answer?: string; wager?: number; verdict?: boolean | null },
  current: boolean,
): FinalRevealRow {
  const player = state.players.find((candidate) => candidate.id === playerId);
  const scoreAfter = player?.score ?? 0;
  const stake = entry.wager ?? 0;
  const delta = entry.verdict === true ? stake : entry.verdict === false ? -stake : 0;
  return {
    playerId,
    displayName: player?.displayName ?? playerId,
    answer: entry.answer,
    wager: entry.wager,
    verdict: entry.verdict,
    scoreBefore: scoreAfter - delta,
    scoreAfter,
    current,
  };
}

/** The live Final on the board, or null when the clue up is not Final. */
export function getFinalReveal(state: PublicGameState): FinalReveal | null {
  const clue = state.currentClue;
  if (!clue || clue.kind !== "final") return null;

  const nameOf = (id: string) =>
    state.players.find((player) => player.id === id)?.displayName ?? id;
  const phase = phases[clue.phase] ?? "answering";
  const revealing = phase === "revealing" || phase === "done";
  const spectators = new Set(state.players.filter((p) => p.spectator).map((p) => p.id));

  const ids = revealing
    ? [...new Set([...Object.keys(clue.answers ?? {}), ...Object.keys(clue.wagers ?? {})])]
    : [];
  const rows = ids
    .filter((id) => !spectators.has(id))
    .map((id) =>
      row(
        state,
        id,
        { answer: clue.answers?.[id], wager: clue.wagers?.[id], verdict: clue.judges?.[id] },
        clue.currentJudgePlayerId === id,
      ),
    )
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

/** How Final went, for the results screen; null when it was not played. */
export function getFinalRecord(state: PublicGameState): FinalReveal | null {
  const record = state.results?.finalJeopardy;
  if (!record) return null;
  return {
    phase: "done",
    category: record.category,
    clue: record.clue,
    correctResponse: record.correctResponse,
    waitingFor: [],
    rows: record.entries.map((entry) =>
      row(
        state,
        entry.playerId,
        { answer: entry.answer, wager: entry.wager, verdict: entry.correct },
        false,
      ),
    ),
  };
}
