/**
 * What a screen reader should hear when the game moves on.
 *
 * Pure: two snapshots of what this client could see (before and after) go in,
 * a list of short sentences comes out. The component that owns the live
 * region only diffs and speaks; deciding what is worth saying is here, where
 * it can be tested without a browser.
 */
import type { GameRound, PublicGameState } from "./contracts";
import { formatScore, nameOf, type CluePhase } from "./clue-turn";

export interface AnnouncerFrame {
  state: PublicGameState | null;
  /** The clue phase as the client worked it out at that instant. */
  phase: CluePhase;
}

const roundTitles: Partial<Record<GameRound, string>> = {
  jeopardy: "The Jeopardy round",
  "double-jeopardy": "Double Jeopardy",
  "triple-jeopardy": "Triple Jeopardy",
  "final-jeopardy": "Final Jeopardy",
  complete: "Game over",
};

export function announce(
  previous: AnnouncerFrame,
  next: AnnouncerFrame,
  selfId: string,
): string[] {
  const before = previous.state;
  const after = next.state;
  if (!after) return [];
  const lines: string[] = [];
  const who = (id: string) => (id === selfId ? "You" : nameOf(after, id));

  if (before && before.round !== after.round) {
    const title = roundTitles[after.round];
    if (title) lines.push(`${title}.`);
  }

  const was = before?.currentClue;
  const clue = after.currentClue;

  if (clue) {
    const sameClue = was?.clueId === clue.clueId;
    const isFinal = clue.round === "final-jeopardy";

    if (!sameClue && clue.dailyDouble && !isFinal) {
      const player = clue.dailyDoublePlayerId;
      lines.push(
        player === selfId
          ? "Daily Double! Make your wager."
          : `Daily Double! ${player ? who(player) : "The picker"} is wagering.`,
      );
    }

    if (clue.clue !== undefined && (!sameClue || was?.clue === undefined)) {
      const header = isFinal
        ? `Final Jeopardy, ${clue.category}`
        : clue.dailyDouble
          ? `${clue.category}, Daily Double`
          : `${clue.category} for $${clue.value}`;
      lines.push(`${header}: ${clue.clue}`);
    }

    if (previous.phase !== next.phase && sameClue) {
      if (next.phase === "ring-in") lines.push("Buzzers open.");
    }

    // A ring-in. Final and Daily Doubles fill everyone owed in at once; there
    // is no race to announce.
    if (!isFinal && !clue.dailyDouble) {
      for (const id of Object.keys(clue.buzzes)) {
        if (sameClue && was?.buzzes[id] !== undefined) continue;
        lines.push(
          id === selfId ? "You rang in. Answer now." : `${who(id)} rang in.`,
        );
      }
    }

    if (clue.correctResponse !== undefined && (!sameClue || was?.correctResponse === undefined)) {
      if (clue.timedOut) lines.push("Time's up.");
      lines.push(`The answer: ${clue.correctResponse}.`);
    }

    for (const id of Object.keys(clue.judges)) {
      if (sameClue && was && id in was.judges) continue;
      const verdict = clue.judges[id];
      const score = after.players.find((player) => player.id === id)?.score ?? 0;
      const name = who(id);
      lines.push(
        verdict === true
          ? `Correct. ${name} ${name === "You" ? "have" : "has"} ${formatScore(score)}.`
          : verdict === false
            ? `Incorrect. ${name} ${name === "You" ? "have" : "has"} ${formatScore(score)}.`
            : `No ruling for ${name}.`,
      );
    }

    if (sameClue && was) {
      const undone = Object.keys(was.judges).filter((id) => !(id in clue.judges));
      if (undone.length > 0) lines.push("Ruling undone.");
    }
  } else if (was && after.round !== "complete") {
    const picker = after.pickerId;
    if (picker) lines.push(picker === selfId ? "Your pick." : `${who(picker)} picks.`);
  }

  return lines;
}
