/**
 * The final standings as a screen shows them.
 *
 * The room already ranks contestants (`standings`, spectators excluded,
 * ties sharing a rank) and names the winners (`results.winners`: the top
 * score, and only when it is above zero — on the show a contestant must
 * finish in the black to win). This joins those ids back to the players so
 * every results screen — the laptop, the phone, the TV — reads one answer.
 *
 * A snapshot from an older room without `standings` still ranks from the
 * player list, contestants only.
 */
import type { PublicGameState, PublicPlayerState } from "./contracts";

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
  /** Crowned: the top score, above zero. Several on a tie; none if all ≤ $0. */
  winners: PublicPlayerState[];
  /** The top score, whatever it is. */
  leaders: PublicPlayerState[];
  tie: boolean;
}

export function contestantsOf<T extends { spectator: boolean }>(players: readonly T[]): T[] {
  return players.filter((player) => !player.spectator);
}

function rankFromPlayers(players: readonly PublicPlayerState[]) {
  const sorted = contestantsOf(players).sort((a, b) => b.score - a.score);
  return sorted.map((player) => ({
    playerId: player.id,
    score: player.score,
    rank: sorted.findIndex((other) => other.score === player.score) + 1,
  }));
}

export function computeResults(state: PublicGameState): GameResults {
  const byId = new Map(state.players.map((player) => [player.id, player]));
  const ranked = (state.standings ?? rankFromPlayers(state.players)).filter(
    (entry) => byId.has(entry.playerId) && !byId.get(entry.playerId)!.spectator,
  );
  const leaderIds =
    state.results?.leaders ?? ranked.filter((entry) => entry.rank === 1).map((e) => e.playerId);
  const winnerIds =
    state.results?.winners ??
    leaderIds.filter((id) => (byId.get(id)?.score ?? 0) > 0);
  const winnerSet = new Set(winnerIds);
  const counts = new Map<number, number>();
  for (const entry of ranked) counts.set(entry.rank, (counts.get(entry.rank) ?? 0) + 1);

  const standings = ranked.map<Standing>((entry) => ({
    player: byId.get(entry.playerId)!,
    rank: entry.rank,
    winner: winnerSet.has(entry.playerId),
    tied: (counts.get(entry.rank) ?? 0) > 1,
  }));
  const pick = (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((player): player is PublicPlayerState => Boolean(player));
  const winners = pick(winnerIds);
  return { standings, winners, leaders: pick(leaderIds), tie: winners.length > 1 };
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
