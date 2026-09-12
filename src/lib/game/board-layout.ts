import type { PublicBoardClue } from "./contracts";

export interface BoardColumn {
  category: string;
  /** One entry per rung of the ladder; null where the archive has no clue. */
  cells: Array<PublicBoardClue | null>;
}

export interface BoardLayout {
  /** The round's values, low to high: the rows of the board. */
  ladder: number[];
  columns: BoardColumn[];
}

/**
 * Lays the round out as the set does: every category is a column, every
 * value a row, and a clue sits in the row its value names.
 *
 * The archive is what was revealed on air, and a 1989 game that ran out of
 * time is missing the bottom of a category or two — sometimes a rung in the
 * middle. Placing clues by their position in the list put the $1000 clue in
 * the $800 row whenever the $800 was missing, and left a hole in the board
 * below it. Here the row is the value, and a missing clue is an empty cell,
 * the same blue as a played one: the board is always whole.
 *
 * Categories are kept in the order the clues arrive, which is the order the
 * archive prints them across the top of the board.
 */
export function layoutBoard(clues: PublicBoardClue[]): BoardLayout {
  const ladder = Array.from(new Set(clues.map((clue) => clue.value))).sort(
    (a, b) => a - b,
  );

  const byCategory = new Map<string, PublicBoardClue[]>();
  for (const clue of clues) {
    const list = byCategory.get(clue.category) ?? [];
    list.push(clue);
    byCategory.set(clue.category, list);
  }

  const columns = Array.from(byCategory.entries()).map(([category, list]) => {
    const sorted = [...list].sort((a, b) => a.value - b.value);
    const distinct = new Set(sorted.map((clue) => clue.value)).size === sorted.length;
    // A custom game can price two clues the same in one category; those
    // have no row of their own, so they take the list order instead.
    const cells: Array<PublicBoardClue | null> = distinct
      ? ladder.map((value) => sorted.find((clue) => clue.value === value) ?? null)
      : ladder.map((_, index) => sorted[index] ?? null);
    return { category, cells };
  });

  return { ladder, columns };
}
