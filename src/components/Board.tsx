"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import type { PublicBoardClue, PublicGameState } from "@/lib/game";
import { useGameStore } from "@/lib/state/game-store";
import { primeAudio, primeSpeech, playSfx } from "@/lib/ai";
import {
  boardColumns,
  boardRows,
  jeopardyFonts,
  jeopardyPalette,
  jeopardyTextShadow,
} from "@/lib/foundation/jeopardy-style";

interface BoardProps {
  state: PublicGameState | null;
  onPick?: (clueId: string) => void;
  canPick?: boolean;
  /** Full-board clue panel. Rendered over the grid with the reveal zoom. */
  overlay?: ReactNode;
}

const PLACEHOLDER_VALUES = [200, 400, 600, 800, 1000];

export function Board({ state, onPick, canPick = false, overlay }: BoardProps) {
  const reducedMotion = useGameStore((s) => s.preferences.reducedMotion);
  const soundEnabled = useGameStore((s) => s.preferences.soundEnabled);
  const board = state?.board;
  const byCategory = useMemo(() => groupByCategory(board ?? []), [board]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const tileRefs = useRef(new Map<string, HTMLElement>());
  const activeClueId = state?.currentClue?.clueId ?? null;
  useClueZoom(containerRef, overlayRef, tileRefs, activeClueId, reducedMotion);

  // The board only fills in once per round, the way the set lights up.
  const roundKey = state?.round ?? "empty";

  if (byCategory.length === 0) {
    return (
      <BoardFrame ref={containerRef} ratio={boardColumns / (boardRows + 0.8)}>
        <BoardGrid columns={boardColumns} rows={boardRows}>
          {Array.from({ length: boardColumns }).map((_, col) => (
            <CategoryCell key={`hdr-${col}`} column={col + 1} label="" />
          ))}
          {Array.from({ length: boardColumns }).flatMap((_, col) =>
            PLACEHOLDER_VALUES.map((value, row) => (
              <Box
                key={`cell-${col}-${row}`}
                sx={{
                  gridRow: row + 2,
                  gridColumn: col + 1,
                  ...cellSurface,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: jeopardyFonts.display,
                  fontSize: "clamp(18px, 3.2vw, 44px)",
                  fontWeight: 700,
                  color: "rgba(214,159,76,0.16)",
                }}
              >
                ${value}
              </Box>
            )),
          )}
        </BoardGrid>
        {overlay}
      </BoardFrame>
    );
  }

  const rowCount = Math.max(...byCategory.map((column) => column.clues.length));

  return (
    <BoardFrame
      ref={containerRef}
      ratio={byCategory.length / (rowCount + 0.8)}
    >
      <BoardGrid columns={byCategory.length} rows={rowCount}>
        {byCategory.map((column, columnIndex) => (
          <CategoryCell
            key={`hdr-${column.category}`}
            column={columnIndex + 1}
            label={column.category}
            delayMs={reducedMotion ? 0 : columnIndex * 70}
            animationKey={roundKey}
            reducedMotion={reducedMotion}
          />
        ))}
        {byCategory.flatMap((column, columnIndex) =>
          column.clues.map((clue, rowIndex) => (
            <ClueTile
              key={clue.id}
              clue={clue}
              column={columnIndex + 1}
              row={rowIndex + 2}
              disabled={!canPick || clue.revealed}
              hidden={clue.id === activeClueId}
              reducedMotion={reducedMotion}
              animationKey={roundKey}
              delayMs={reducedMotion ? 0 : 260 + (columnIndex + rowIndex * 2) * 45}
              registerRef={(node) => {
                if (node) tileRefs.current.set(clue.id, node);
                else tileRefs.current.delete(clue.id);
              }}
              onPick={() => {
                primeAudio();
                primeSpeech();
                if (soundEnabled) playSfx("select");
                onPick?.(clue.id);
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

const cellSurface = {
  background: `linear-gradient(180deg, ${jeopardyPalette.board} 0%, ${jeopardyPalette.boardDeep} 100%)`,
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
} as const;

/**
 * The board keeps the set's proportions and never grows past the space it
 * has: width is capped by both the column and the height budget, so it
 * stays fully on screen with the podiums below it.
 */
function BoardFrame({
  children,
  ref,
  ratio,
}: {
  children: ReactNode;
  ref: React.Ref<HTMLDivElement>;
  ratio: number;
}) {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
      <Box
        ref={ref}
        data-testid="board"
        sx={{
          position: "relative",
          "--board-height": {
            xs: "min(52vh, 460px)",
            md: "min(60vh, 620px)",
          },
          width: `min(100%, calc(var(--board-height) * ${ratio}))`,
          aspectRatio: `${ratio}`,
          background: jeopardyPalette.gap,
          p: { xs: 0.5, sm: 0.75 },
          overflow: "hidden",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function BoardGrid({
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
        height: "100%",
      }}
    >
      {children}
    </Box>
  );
}

function CategoryCell({
  column,
  label,
  delayMs = 0,
  animationKey,
  reducedMotion,
}: {
  column: number;
  label: string;
  delayMs?: number;
  animationKey?: string;
  reducedMotion?: boolean;
}) {
  return (
    <Box
      key={`${animationKey}-${column}`}
      sx={{
        gridRow: 1,
        gridColumn: column,
        ...cellSurface,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 0.5,
        textAlign: "center",
        fontFamily: jeopardyFonts.display,
        textTransform: "uppercase",
        fontWeight: 600,
        letterSpacing: "0.02em",
        lineHeight: 1.05,
        color: jeopardyPalette.categoryText,
        textShadow: jeopardyTextShadow,
        fontSize: "clamp(9px, 1.15vw, 17px)",
        overflow: "hidden",
        animation: reducedMotion ? "none" : `board-drop 420ms ${delayMs}ms both ease-out`,
        "@keyframes board-drop": {
          from: { opacity: 0, transform: "translateY(-18px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      }}
    >
      {label}
    </Box>
  );
}

function ClueTile({
  clue,
  column,
  row,
  disabled,
  hidden,
  reducedMotion,
  delayMs,
  animationKey,
  onPick,
  registerRef,
}: {
  clue: PublicBoardClue;
  column: number;
  row: number;
  disabled: boolean;
  hidden: boolean;
  reducedMotion: boolean;
  delayMs: number;
  animationKey: string;
  onPick: () => void;
  registerRef: (node: HTMLElement | null) => void;
}) {
  // A played clue leaves an empty blue cell — the value simply goes away.
  const spent = clue.revealed;
  return (
    <ButtonBase
      key={`${animationKey}-${clue.id}`}
      ref={registerRef}
      onClick={onPick}
      disabled={disabled}
      focusRipple
      aria-label={spent ? `${clue.category}, played` : `${clue.category}, $${clue.value}`}
      sx={{
        gridRow: row,
        gridColumn: column,
        ...cellSurface,
        justifyContent: "center",
        fontFamily: jeopardyFonts.display,
        fontWeight: 700,
        fontSize: "clamp(18px, 3.1vw, 46px)",
        color: jeopardyPalette.gold,
        textShadow: jeopardyTextShadow,
        opacity: hidden ? 0 : 1,
        cursor: disabled ? "default" : "pointer",
        transition: reducedMotion ? "none" : "filter 140ms ease, transform 140ms ease",
        animation: reducedMotion
          ? "none"
          : `tile-in 320ms ${delayMs}ms both cubic-bezier(0.2, 0.8, 0.3, 1)`,
        "@keyframes tile-in": {
          from: { opacity: 0, transform: "scale(0.86)" },
          to: { opacity: 1, transform: "scale(1)" },
        },
        "&:hover": disabled
          ? undefined
          : {
              filter: "brightness(1.35)",
              transform: reducedMotion ? "none" : "scale(1.02)",
            },
        "&.Mui-disabled": { color: jeopardyPalette.gold },
        "&:focus-visible": {
          outline: `3px solid ${jeopardyPalette.goldBright}`,
          outlineOffset: "-3px",
        },
      }}
    >
      {spent ? "" : `$${clue.value}`}
    </ButtonBase>
  );
}

/**
 * Grows the clue panel out of the square that was picked, the way the set's
 * monitor expands the selected cell. Driven straight through the Web
 * Animations API so no render depends on a measurement.
 */
function useClueZoom(
  containerRef: React.RefObject<HTMLDivElement | null>,
  overlayRef: React.RefObject<HTMLDivElement | null>,
  tileRefs: React.RefObject<Map<string, HTMLElement>>,
  activeClueId: string | null,
  reducedMotion: boolean,
) {
  useEffect(() => {
    if (!activeClueId || reducedMotion) return;
    const container = containerRef.current;
    const overlay = overlayRef.current;
    const tile = tileRefs.current?.get(activeClueId);
    if (!container || !overlay || !tile) return;
    if (typeof overlay.animate !== "function") return;

    const board = container.getBoundingClientRect();
    const cell = tile.getBoundingClientRect();
    if (board.width === 0 || board.height === 0 || cell.width === 0) return;

    overlay.animate(
      [
        {
          transform: `translate(${cell.left - board.left}px, ${cell.top - board.top}px) scale(${
            cell.width / board.width
          }, ${cell.height / board.height})`,
          opacity: 0.85,
        },
        { transform: "translate(0px, 0px) scale(1, 1)", opacity: 1 },
      ],
      { duration: 380, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)", fill: "none" },
    );
  }, [activeClueId, reducedMotion, containerRef, overlayRef, tileRefs]);
}

function groupByCategory(clues: PublicBoardClue[]) {
  const map = new Map<string, PublicBoardClue[]>();
  for (const clue of clues) {
    const list = map.get(clue.category) ?? [];
    list.push(clue);
    map.set(clue.category, list);
  }
  return Array.from(map.entries()).map(([category, list]) => ({
    category,
    clues: list.sort((a, b) => a.value - b.value),
  }));
}
