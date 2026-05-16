"use client";

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { PublicBoardClue, PublicGameState } from "@/lib/game";
import { useGameStore } from "@/lib/state/game-store";

interface BoardProps {
  state: PublicGameState;
  onPick: (clueId: string) => void;
  canPick: boolean;
}

export function Board({ state, onPick, canPick }: BoardProps) {
  const reducedMotion = useGameStore((s) => s.preferences.reducedMotion);
  const { board } = state;
  const byCategory = useMemo(() => groupByCategory(board), [board]);

  if (board.length === 0) {
    return (
      <Box
        sx={{
          p: 6,
          borderRadius: 3,
          border: "1px dashed",
          borderColor: "divider",
          textAlign: "center",
        }}
      >
        <Typography variant="h5" sx={{ mb: 1 }}>
          {state.round === "complete" ? "Game complete" : "Get ready"}
        </Typography>
        <Typography color="text.secondary">
          {state.round === "complete"
            ? "Final scoreboard below."
            : "Waiting for the next round to begin."}
        </Typography>
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
              onClick={() => onPick(clue.id)}
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
