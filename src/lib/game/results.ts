/**
 * The final standings, worked out once for every screen that shows them.
 *
 * Only contestants stand: a spectator — a television, someone watching —
 * holds $0 and no seat, and must never be listed, let alone crowned. Ties
 * share a rank (1, 1, 3), and every player on the top score is a winner.
 */
import type { PublicPlayerState } from "./contracts";

export interface Standing {
  player: PublicPlayerState;
  /** Competition rank: tied scores share it, and the next rank skips. */
  rank: number;
  winner: boolean;
  /** True when someone else holds the same score. */
  tied: boolean;
}

export interface GameResults {
  standings: Standing[];
  winners: PublicPlayerState[];
  tie: boolean;
}

export function contestantsOf<T extends { spectator: boolean }>(players: readonly T[]): T[] {
  return players.filter((player) => !player.spectator);
}

export function computeResults(players: readonly PublicPlayerState[]): GameResults {
  const sorted = contestantsOf(players).sort(
    (a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName),
  );
  const top = sorted[0]?.score;
  const counts = new Map<number, number>();
  for (const player of sorted) counts.set(player.score, (counts.get(player.score) ?? 0) + 1);

  let rank = 0;
  const standings = sorted.map<Standing>((player, index) => {
    if (index === 0 || sorted[index - 1].score !== player.score) rank = index + 1;
    return {
      player,
      rank,
      winner: player.score === top,
      tied: (counts.get(player.score) ?? 0) > 1,
    };
  });
  const winners = standings.filter((entry) => entry.winner).map((entry) => entry.player);
  return { standings, winners, tie: winners.length > 1 };
}

/** "Ada", "Ada & Grace", "Ada, Grace & Linus". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/** The ordinal a screen reader and a sighted player both understand. */
export function ordinal(rank: number): string {
  const tens = rank % 100;
  if (tens >= 11 && tens <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}
