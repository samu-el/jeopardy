"use client";

import { useMemo, useRef, type ReactNode } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import type { PublicGameState } from "@/lib/game";
import { layoutBoard } from "@/lib/game/board-layout";
import { useGameStore } from "@/lib/state/game-store";
import { primeAudio, primeSpeech, playSfx } from "@/lib/ai";
import {
  boardColumns,
  boardRows,
  displayType,
  jeopardyPalette,
  jeopardyTextShadow,
} from "@/lib/foundation/jeopardy-style";
import {
  BoardFrame,
  BoardGrid,
  boardRatio,
  categoryFontSize,
  cellSurface,
  enterAnimation,
  valueFontSize,
} from "./board/BoardFrame";
import { useClueZoom } from "./board/use-clue-zoom";

interface BoardProps {
  state: PublicGameState | null;
  onPick?: (clueId: string) => void;
  canPick?: boolean;
  /** Full-board clue panel. Rendered over the grid with the reveal zoom. */
  overlay?: ReactNode;
  /**
   * Television: the grid takes the height it is given instead of the
   * laptop-sized cap. Cell type is sized from the board, so filling the
   * screen is what makes a clue readable from a sofa.
   */
  fill?: boolean;
}

/**
 * One cell, whatever is behind it.
 *
 * A category strip, a value you can press, a square the archive never had,
 * and the ghost board that stands in before a game is dealt are all the same
 * blue rectangle with different text — so they are one component rather than
 * four near-copies of the same `sx` block.
 */
type Tile =
  | { kind: "category"; label: string }
  | { kind: "value"; clueId: string; label: string; aria: string; pickable: boolean; hidden: boolean }
  | { kind: "blank" }
  | { kind: "ghost"; label: string };

export function Board({ state, onPick, canPick = false, overlay, fill }: BoardProps) {
  const reducedMotion = useGameStore((s) => s.preferences.reducedMotion);
  const soundEnabled = useGameStore((s) => s.preferences.soundEnabled);
  const board = state?.board;
  const layout = useMemo(() => layoutBoard(board ?? []), [board]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const tileRefs = useRef(new Map<string, HTMLElement>());
  const activeClueId = state?.currentClue?.clueId ?? null;
  useClueZoom(containerRef, overlayRef, tileRefs, activeClueId, reducedMotion);

  // The board only fills in once per round, the way the set lights up.
  const roundKey = state?.round ?? "empty";
  const dealt = layout.columns.length > 0;
  const columns = dealt ? layout.columns.length : boardColumns;
  const rows = dealt ? layout.ladder.length : boardRows;

  // One grid for both states: before a game is dealt the same frame draws a
  // ghost board, so there is no second copy of the board's markup to keep in
  // step with this one.
  const grid: Tile[][] = dealt
    ? layout.columns.map((column) => [
        { kind: "category", label: column.category },
        ...column.cells.map<Tile>((clue) =>
          clue === null
            ? { kind: "blank" }
            : {
                kind: "value",
                clueId: clue.id,
                label: clue.revealed ? "" : `$${clue.value}`,
                aria: clue.revealed
                  ? `${clue.category}, played`
                  : `${clue.category}, $${clue.value}`,
                pickable: canPick && !clue.revealed,
                hidden: clue.id === activeClueId,
              },
        ),
      ])
    : Array.from({ length: boardColumns }, () => [
        { kind: "category", label: "" } as Tile,
        ...ghostValues.map<Tile>((value) => ({ kind: "ghost", label: `$${value}` })),
      ]);

  return (
    <BoardFrame
      ref={containerRef}
      ratio={boardRatio(columns, rows)}
      tall={Boolean(overlay)}
      fill={fill}
    >
      <BoardGrid columns={columns} rows={rows}>
        {grid.flatMap((column, columnIndex) =>
          column.map((tile, rowIndex) => (
            <Cell
              key={`${roundKey}-${columnIndex}-${rowIndex}-${tile.kind}`}
              tile={tile}
              column={columnIndex + 1}
              row={rowIndex + 1}
              columns={columns}
              reducedMotion={reducedMotion}
              delayMs={
                reducedMotion
                  ? 0
                  : rowIndex === 0
                    ? columnIndex * 70
                    : 260 + (columnIndex + (rowIndex - 1) * 2) * 45
              }
              registerRef={(node) => {
                if (tile.kind !== "value") return;
                if (node) tileRefs.current.set(tile.clueId, node);
                else tileRefs.current.delete(tile.clueId);
              }}
              onPick={() => {
                if (tile.kind !== "value") return;
                primeAudio();
                primeSpeech();
                if (soundEnabled) playSfx("select");
                onPick?.(tile.clueId);
              }}
            />
          )),
        )}
      </BoardGrid>
      {overlay ? (
        <Box
          ref={overlayRef}
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            display: "flex",
            transformOrigin: "top left",
          }}
        >
          {overlay}
        </Box>
      ) : null}
    </BoardFrame>
  );
}

const ghostValues = [200, 400, 600, 800, 1000];

function Cell({
  tile,
  column,
  row,
  columns,
  reducedMotion,
  delayMs,
  onPick,
  registerRef,
}: {
  tile: Tile;
  column: number;
  row: number;
  columns: number;
  reducedMotion: boolean;
  delayMs: number;
  onPick: () => void;
  registerRef: (node: HTMLElement | null) => void;
}) {
  const place = { gridRow: row, gridColumn: column, ...cellSurface } as const;

  if (tile.kind === "category") {
    return (
      <Box
        sx={{
          ...place,
          ...displayType({
            fontWeight: 600,
            letterSpacing: "0.02em",
            fontSize: categoryFontSize(columns),
          }),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 0.5,
          textAlign: "center",
          lineHeight: 1.05,
          color: jeopardyPalette.categoryText,
          textShadow: jeopardyTextShadow,
          overflow: "hidden",
          // Break inside a word only when a long category can't fit otherwise.
          overflowWrap: "break-word",
          animation: reducedMotion ? "none" : `board-drop 420ms ${delayMs}ms both ease-out`,
          "@keyframes board-drop": {
            from: { opacity: 0, transform: "translateY(-18px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
        }}
      >
        {tile.label}
      </Box>
    );
  }

  // A square the archive never had, and a square in the board that stands in
  // before a game is dealt: both are just the blue face, one with faint type.
  if (tile.kind === "blank" || tile.kind === "ghost") {
    return (
      <Box
        aria-hidden
        sx={{
          ...place,
          ...enterAnimation(delayMs, reducedMotion),
          ...displayType({ fontWeight: 700, fontSize: valueFontSize(columns) }),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(214,159,76,0.16)",
        }}
      >
        {tile.kind === "ghost" ? tile.label : ""}
      </Box>
    );
  }

  return (
    <ButtonBase
      ref={registerRef}
      onClick={onPick}
      disabled={!tile.pickable}
      focusRipple
      aria-label={tile.aria}
      sx={{
        ...place,
        ...enterAnimation(delayMs, reducedMotion),
        ...displayType({ fontWeight: 700, fontSize: valueFontSize(columns) }),
        justifyContent: "center",
        color: jeopardyPalette.gold,
        textShadow: jeopardyTextShadow,
        opacity: tile.hidden ? 0 : 1,
        cursor: tile.pickable ? "pointer" : "default",
        transition: reducedMotion ? "none" : "filter 140ms ease, transform 140ms ease",
        "&:hover": tile.pickable
          ? { filter: "brightness(1.35)", transform: reducedMotion ? "none" : "scale(1.02)" }
          : undefined,
        "&.Mui-disabled": { color: jeopardyPalette.gold },
        "&:focus-visible": {
          outline: `3px solid ${jeopardyPalette.goldBright}`,
          outlineOffset: "-3px",
        },
      }}
    >
      {tile.label}
    </ButtonBase>
  );
}
