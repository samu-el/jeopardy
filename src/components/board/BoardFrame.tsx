"use client";

import Box from "@mui/material/Box";
import type { ReactNode, Ref } from "react";
import { jeopardyPalette } from "@/lib/foundation/jeopardy-style";
import { compactPlayQuery } from "../use-reduced-motion";

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

/** Never under 11px: a phone's six columns still have to be read. */
export function categoryFontSize(columns: number): string {
  return `clamp(11px, ${(9.5 / columns).toFixed(2)}cqw, 18px)`;
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

interface BoardFrameProps {
  children: ReactNode;
  ref: Ref<HTMLDivElement>;
  ratio: number;
  /** A clue panel needs more vertical room than the grid does on a phone. */
  tall?: boolean;
  /** Take the height the screen offers rather than the desk-sized cap. */
  fill?: boolean;
  /** The board's name, for the focus that lands on it when a clue closes. */
  label?: string;
}

/**
 * The board keeps the set's proportions and never grows past the space it
 * has: width is capped by both the column count and the height budget, so it
 * stays fully on screen with the lecterns below it.
 */
export function BoardFrame({ children, ref, ratio, tall, fill, label }: BoardFrameProps) {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
      <Box
        ref={ref}
        data-testid="board"
        tabIndex={-1}
        role="group"
        aria-label={label ?? "Board"}
        sx={{
          outline: "none",
          position: "relative",
          // A 660px cap is right on a desk and wrong on a television: it
          // leaves a small board marooned in black. When the screen says how
          // much height there is, take it.
          "--board-height": fill
            ? "var(--board-fill-height, 74dvh)"
            : {
                xs: tall ? "min(64vh, 540px)" : "min(46vh, 420px)",
                // While a clue is up there is a strip of controls under the
                // board and lecterns under that. Give them the room rather
                // than pushing a player's own score off a laptop screen.
                md: tall ? "min(53vh, 590px)" : "min(60vh, 640px)",
              },
          width: `min(100%, calc(var(--board-height) * ${ratio}))`,
          // The grid keeps the set's proportions. A clue panel on a phone
          // does not — it needs height for the buzzer and the answer field.
          // A television has the room for both, so it keeps the ratio.
          aspectRatio: tall && !fill ? { xs: "auto", md: `${ratio}` } : `${ratio}`,
          height: tall && !fill ? { xs: "min(66vh, 560px)", md: "auto" } : "auto",
          // Cell type is sized from the board, not the viewport, so a
          // six-category board and a two-category one both read correctly.
          containerType: "inline-size",
          background: jeopardyPalette.gap,
          p: { xs: 0.5, sm: 0.75 },
          overflow: "hidden",
          // A phone, or a phone on its side: size the board and the clue
          // from the height actually left (dvh, not the URL-bar-less vh),
          // leaving room for the clock strip and the buzz bar under it.
          ...(fill
            ? null
            : {
                [compact]: {
                  "--board-height": "clamp(170px, calc(100dvh - 130px), 420px)",
                  ...(tall
                    ? {
                        aspectRatio: "auto",
                        height: "clamp(170px, calc(100dvh - 300px), 560px)",
                        // The keyboard is up: fit what is left above it.
                        "html[data-keyboard-open] &": {
                          height: "max(120px, calc(var(--keyboard-viewport-height, 100dvh) - 150px))",
                        },
                      }
                    : null),
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
  children,
}: {
  columns: number;
  rows: number;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: { xs: "3px", sm: "6px" },
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `0.8fr repeat(${rows}, 1fr)`,
        // A phone's category strip needs three lines of 11px type.
        [compact]: { gridTemplateRows: `1.35fr repeat(${rows}, 1fr)` },
        height: "100%",
      }}
    >
      {children}
    </Box>
  );
}
