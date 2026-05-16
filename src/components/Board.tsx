"use client";

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import type { PublicBoardClue, PublicGameState } from "@/lib/game";
import { useGameStore } from "@/lib/state/game-store";
import { primeAudio, primeSpeech } from "@/lib/ai";

interface BoardProps {
  state: PublicGameState | null;
  onPick?: (clueId: string) => void;
  canPick?: boolean;
}

const PLACEHOLDER_COLS = 6;
const PLACEHOLDER_ROWS = 5;
const PLACEHOLDER_VALUES = [200, 400, 600, 800, 1000];

export function Board({ state, onPick, canPick = false }: BoardProps) {
  const reducedMotion = useGameStore((s) => s.preferences.reducedMotion);
  const board = state?.board;
  const byCategory = useMemo(() => groupByCategory(board ?? []), [board]);

  if (byCategory.length === 0) {
    return (
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: `repeat(${PLACEHOLDER_COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `minmax(56px, auto) repeat(${PLACEHOLDER_ROWS}, minmax(56px, 1fr))`,
        }}
      >
        {Array.from({ length: PLACEHOLDER_COLS }).map((_, col) => (
          <Box
            key={`hdr-${col}`}
            sx={{
              gridRow: 1,
              gridColumn: col + 1,
              background: "linear-gradient(135deg, #1e3094 0%, #0a1336 100%)",
              borderRadius: 1.5,
            }}
          />
        ))}
        {Array.from({ length: PLACEHOLDER_COLS }).flatMap((_, col) =>
          PLACEHOLDER_VALUES.map((value, row) => (
            <Box
              key={`cell-${col}-${row}`}
              sx={{
                gridRow: row + 2,
                gridColumn: col + 1,
                background: "linear-gradient(135deg, #14245c 0%, #0a1336 100%)",
                borderRadius: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,210,59,0.18)",
                fontSize: { xs: 16, sm: 24, md: 28 },
                fontWeight: 800,
              }}
            >
              ${value}
            </Box>
          )),
        )}
      </Box>
    );
  }

  const rowCount = Math.max(...byCategory.map((c) => c.clues.length));

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1,
        gridTemplateColumns: `repeat(${byCategory.length}, minmax(0, 1fr))`,
        gridTemplateRows: `minmax(56px, auto) repeat(${rowCount}, minmax(56px, 1fr))`,
      }}
    >
      {byCategory.map((column, colIndex) => (
        <Box
          key={`hdr-${column.category}`}
          sx={{
            gridRow: 1,
            gridColumn: colIndex + 1,
            backgroundColor: "primary.dark",
            color: "primary.contrastText",
            borderRadius: 1.5,
            p: { xs: 0.8, sm: 1.2 },
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            fontWeight: 700,
            fontSize: { xs: 11, sm: 13, md: 14 },
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1.15,
          }}
        >
          {column.category}
        </Box>
      ))}
      {byCategory.flatMap((column, colIndex) =>
        column.clues.map((clue, rowIndex) => (
          <Button
            key={clue.id}
            onClick={() => {
              primeAudio();
              primeSpeech();
              onPick?.(clue.id);
            }}
            disabled={!canPick || clue.revealed}
            variant="contained"
            sx={{
              gridRow: rowIndex + 2,
              gridColumn: colIndex + 1,
              position: "relative",
              background: clue.revealed
                ? "transparent"
                : "linear-gradient(135deg, #14245c 0%, #0a1336 100%)",
              color: clue.revealed ? "text.disabled" : "secondary.main",
              fontSize: { xs: 16, sm: 24, md: 28 },
              fontWeight: 800,
              border: clue.revealed ? "1px solid" : "none",
              borderColor: "divider",
              boxShadow: clue.revealed ? "none" : 4,
              transformOrigin: "center",
              transition: reducedMotion
                ? "none"
                : "transform 0.45s cubic-bezier(0.4, 0.0, 0.2, 1), background 0.18s ease",
              transform: clue.revealed && !reducedMotion ? "rotateX(0deg)" : "none",
              animation:
                clue.revealed && !reducedMotion
                  ? "tile-flip 0.5s ease forwards"
                  : "none",
              "@keyframes tile-flip": {
                "0%": { transform: "rotateX(0deg)" },
                "50%": { transform: "rotateX(90deg)" },
                "100%": { transform: "rotateX(0deg)" },
              },
              "&:hover": {
                background: clue.revealed
                  ? "transparent"
                  : "linear-gradient(135deg, #1c2e74 0%, #0d1849 100%)",
                transform: reducedMotion ? "none" : "translateY(-2px)",
              },
              "&.Mui-disabled": {
                color: clue.revealed ? "rgba(255,255,255,0.18)" : "secondary.main",
                background: clue.revealed
                  ? "transparent"
                  : "linear-gradient(135deg, #14245c 0%, #0a1336 100%)",
                opacity: clue.revealed ? 0.6 : 0.85,
              },
            }}
          >
            {clue.revealed ? "—" : `$${clue.value}`}
          </Button>
        )),
      )}
    </Box>
  );
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
