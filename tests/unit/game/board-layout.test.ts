import { describe, expect, it } from "vitest";
import { layoutBoard } from "@/lib/game/board-layout";
import type { PublicBoardClue } from "@/lib/game";

function clue(category: string, value: number, revealed = false): PublicBoardClue {
  return { id: `${category}-${value}`, category, value, revealed };
}

describe("layoutBoard", () => {
  it("puts every clue in the row its value names and fills the gaps", () => {
    // Episode #1059's first round: THE PAPACY stops at $400 and HAIRDOS at $800.
    const clues = [
      ...[200, 400, 600, 800, 1000].map((v) => clue("LAW", v)),
      ...[200, 400, 600, 800].map((v) => clue("HAIRDOS", v)),
      ...[200, 400].map((v) => clue("THE PAPACY", v)),
    ];
    const layout = layoutBoard(clues);

    expect(layout.ladder).toEqual([200, 400, 600, 800, 1000]);
    expect(layout.columns.map((column) => column.category)).toEqual([
      "LAW",
      "HAIRDOS",
      "THE PAPACY",
    ]);
    expect(layout.columns[1].cells.map((cell) => cell?.value ?? null)).toEqual([
      200,
      400,
      600,
      800,
      null,
    ]);
    expect(layout.columns[2].cells.map((cell) => cell?.value ?? null)).toEqual([
      200,
      400,
      null,
      null,
      null,
    ]);
  });

  it("leaves the row empty when the missing clue is in the middle", () => {
    // Episode #3's first round has a category with no $800: the $1000 must
    // stay on the bottom row, not slide up into the $800's place.
    const clues = [
      ...[200, 400, 600, 800, 1000].map((v) => clue("A", v)),
      ...[200, 400, 600, 1000].map((v) => clue("B", v)),
    ];
    const layout = layoutBoard(clues);
    expect(layout.columns[1].cells.map((cell) => cell?.value ?? null)).toEqual([
      200,
      400,
      600,
      null,
      1000,
    ]);
  });

  it("falls back to list order when a category prices two clues the same", () => {
    const clues = [
      clue("A", 100),
      { ...clue("A", 100), id: "A-100-b" },
      clue("A", 300),
    ];
    const layout = layoutBoard(clues);
    expect(layout.ladder).toEqual([100, 300]);
    expect(layout.columns[0].cells.map((cell) => cell?.id ?? null)).toEqual([
      "A-100",
      "A-100-b",
    ]);
  });

  it("keeps played clues in place", () => {
    const layout = layoutBoard([clue("A", 200, true), clue("A", 400)]);
    expect(layout.columns[0].cells[0]).toMatchObject({ value: 200, revealed: true });
  });
});
