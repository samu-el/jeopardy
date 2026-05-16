"use client";

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import type { PublicBoardClue, PublicGameState } from "@/lib/game";
import { useGameStore } from "@/lib/state/game-store";

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
        }}
      >
        {Array.from({ length: PLACEHOLDER_COLS }).map((_, col) => (
          <Box
            key={col}
            sx={{
              display: "grid",
              gap: 1,
              gridTemplateRows: `auto repeat(${PLACEHOLDER_ROWS}, 1fr)`,
            }}
          >
            <Box
              sx={{
                background: "linear-gradient(135deg, #1e3094 0%, #0a1336 100%)",
                borderRadius: 1.5,
                minHeight: { xs: 40, sm: 56 },
              }}
            />
            {PLACEHOLDER_VALUES.map((value, row) => (
              <Box
                key={row}
                sx={{
                  minHeight: { xs: 56, sm: 80, md: 96 },
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
            ))}
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1,
        gridTemplateColumns: `repeat(${byCategory.length}, minmax(0, 1fr))`,
      }}
    >
      {byCategory.map((column) => (
        <Box
          key={column.category}
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateRows: `auto repeat(${column.clues.length}, 1fr)`,
          }}
        >
          <Box
            sx={{
              backgroundColor: "primary.dark",
              color: "primary.contrastText",
              borderRadius: 1.5,
              p: { xs: 0.8, sm: 1.2 },
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              fontWeight: 700,
              fontSize: { xs: 11, sm: 13, md: 14 },
              minHeight: { xs: 40, sm: 56 },
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {column.category}
          </Box>
          {column.clues.map((clue) => (
            <Button
              key={clue.id}
              onClick={() => onPick?.(clue.id)}
              disabled={!canPick || clue.revealed}
              variant="contained"
              sx={{
                minHeight: { xs: 56, sm: 80, md: 96 },
                background: clue.revealed
                  ? "transparent"
                  : "linear-gradient(135deg, #14245c 0%, #0a1336 100%)",
                color: clue.revealed ? "text.disabled" : "secondary.main",
                fontSize: { xs: 16, sm: 24, md: 28 },
                fontWeight: 800,
                border: clue.revealed ? "1px solid" : "none",
                borderColor: "divider",
                boxShadow: clue.revealed ? "none" : 4,
                transition: reducedMotion ? "none" : "transform 0.18s ease, background 0.18s ease",
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
          ))}
        </Box>
      ))}
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
