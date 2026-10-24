"use client";

import Box from "@mui/material/Box";
import type { ReactNode, Ref } from "react";
import { boardColumns, boardRows, jeopardyPalette } from "@/lib/foundation/jeopardy-style";
import { appViewport, viewportFraction } from "@/lib/foundation/viewport";
import { compactPlayQuery } from "../use-compact-play";

const compact = `@media ${compactPlayQuery}`;

/** Cells on the set are landscape, so the board is wider than its counts suggest. */
const cellAspect = 1.6;

export function boardRatio(columns: number, rows: number): number {
  return (columns / (rows + 0.8)) * cellAspect;
}

/** Type that scales with the cell, expressed against the board's own width. */
export function valueFontSize(columns: number): string {
  return `clamp(11px, ${(25 / columns).toFixed(2)}cqw, 46px)`;
}

/**
 * Never under 11px: a phone's six columns still have to be read. On a desk
 * the category strip reads at a glance, three lines at most in its row.
 */
export function categoryFontSize(columns: number): string {
  // A television raises both through CSS variables: 18px is a desk's cap.
  return `clamp(11px, calc(${(12 / columns).toFixed(2)}cqw * var(--board-category-scale, 1)), var(--board-category-max, 18px))`;
}

/** The blue face every cell on the board shares. */
export const cellSurface = {
  background: `linear-gradient(180deg, ${jeopardyPalette.board} 0%, ${jeopardyPalette.boardDeep} 100%)`,
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
} as const;

/** Cells land one after another, the way the set lights up. */
export function enterAnimation(delayMs: number, reducedMotion: boolean) {
  return {
    animation: reducedMotion
      ? "none"
      : `tile-in 320ms ${delayMs}ms both cubic-bezier(0.2, 0.8, 0.3, 1)`,
    "@keyframes tile-in": {
      from: { opacity: 0, transform: "scale(0.86)" },
      to: { opacity: 1, transform: "scale(1)" },
    },
  } as const;
}

/**
 * The stage: the one box the board, the clue, the round title card, the
 * Daily Double and Final all play in. Its size comes from the screen alone,
 * never from what is on it, so nothing changes size when the game moves from
 * one of those to the next.
 *
 * It keeps the proportions of a full six-by-five board. A custom game with
 * fewer categories gets wider cells, not a different stage.
 */
const stageRatio = boardRatio(boardColumns, boardRows);

/**
 * How tall the stage may get when the width allows it: a share of the screen
 * height, less what is stacked above and below it. These are measured from
 * the layout (the toolbar over it, the reserved clock strip and the row of
 * lecterns under it), not from anything that changes during play.
 *
 * - A desk: the toolbar (68), a gap (12), the clock strip (`clockStripSx`)
 *   and a lectern (222). A short window keeps at least 47% of its height
 *   for the stage and lets the lecterns run under the fold; at 768 tall
 *   (a 1024x768 tablet on its side) that is still the whole room on screen.
 * - A phone held upright: a taller toolbar (120), a taller clock strip, a
 *   smaller lectern (172) and the buzz bar pinned to the bottom (84).
 * - A phone on its side: the page scrolls the stage to the top when a clue
 *   opens, so it is the height less the clock strip and the buzz bar.
 */
const stageHeight = {
  desk: `clamp(240px, max(${viewportFraction(0.47)}, ${appViewport.minHeight} - 400px), 640px)`,
  phone: `clamp(200px, ${appViewport.minHeight} - 538px, 560px)`,
  phoneLandscape: `clamp(150px, ${appViewport.minHeight} - 170px, 420px)`,
} as const;

/**
 * A screen too narrow for the board's proportions gives the stage more
 * height instead, up to square, so a clue on a phone is not a letterbox.
 */
const stageMinRatio = 1;

/** A phone on its side, or any window too short for the desk layout. */
const phoneLandscape = "@media (max-height:520px)";
/** A phone held upright: wins over the rule above when both hold. */
const phone = "@media (max-width:599.95px)";

/**
 * Room under the stage for the clock, the answer field, a wager and the
 * judging, held open whether a clue is up or not, so the lecterns under it
 * stay put as they come and go.
 */
export const clockStripSx = {
  minHeight: 96,
  [phoneLandscape]: { minHeight: 96 },
  [phone]: { minHeight: 150 },
} as const;

interface BoardFrameProps {
  children: ReactNode;
  ref: Ref<HTMLDivElement>;
  /** Take the height the screen offers (a television) rather than the desk's share. */
  fill?: boolean;
  /** The board's name, for the focus that lands on it when a clue closes. */
  label?: string;
}

/**
 * The stage frame. Width and height are fitted to the space the screen
 * offers: as wide as the set's proportions allow, never wider than the
 * column it stands in.
 */
export function BoardFrame({ children, ref, fill, label }: BoardFrameProps) {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", width: "100%", containerType: "inline-size" }}>
      <Box
        ref={ref}
        data-testid="board"
        data-stage
        tabIndex={-1}
        role="group"
        aria-label={label ?? "Board"}
        sx={{
          outline: "none",
          position: "relative",
          flex: "0 0 auto",
          "--stage-height": fill ? "var(--board-fill-height, 74dvh)" : stageHeight.desk,
          ...(fill
            ? null
            : {
                [phoneLandscape]: { "--stage-height": stageHeight.phoneLandscape },
                [phone]: { "--stage-height": stageHeight.phone },
              }),
          width: `min(100cqw, calc(var(--stage-height) * ${stageRatio.toFixed(4)}))`,
          height: `min(var(--stage-height), calc(100cqw / ${stageMinRatio}))`,
          // Cell type is sized from the stage, not the viewport, so a
          // six-category board and a two-category one both read correctly.
          containerType: "inline-size",
          background: jeopardyPalette.gap,
          p: { xs: 0.5, sm: 0.75 },
          overflow: "hidden",
          // The keyboard is up: the screen itself just got shorter, so fit
          // what is left above it.
          ...(fill
            ? null
            : {
                [compact]: {
                  "html[data-keyboard-open] &": {
                    height: "max(120px, calc(var(--keyboard-viewport-height, 100dvh) - 150px))",
                  },
                },
              }),
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export function BoardGrid({
  columns,
  rows,
  covered = false,
  children,
}: {
  columns: number;
  rows: number;
  /** A clue is laid over the grid: its squares are out of reach until it closes. */
  covered?: boolean;
  children: ReactNode;
}) {
  return (
    <Box
      inert={covered}
      sx={{
        display: "grid",
        gap: { xs: "3px", sm: "6px" },
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `0.8fr repeat(${rows}, 1fr)`,
        // A phone's category strip needs four lines of 11px type: a long
        // category breaks inside its words at that width.
        [compact]: { gridTemplateRows: `1.8fr repeat(${rows}, 1fr)` },
        height: "100%",
      }}
    >
      {children}
    </Box>
  );
}
