"use client";

import Box from "@mui/material/Box";
import type { GameRound } from "@/lib/game";
import { jeopardyFonts, jeopardyPalette } from "@/lib/foundation/jeopardy-style";

interface RoundIntroProps {
  round: GameRound;
  visible: boolean;
  reducedMotion?: boolean;
}

const titles: Partial<Record<GameRound, string>> = {
  jeopardy: "JEOPARDY!",
  "double-jeopardy": "DOUBLE JEOPARDY!",
  "triple-jeopardy": "TRIPLE JEOPARDY!",
  "final-jeopardy": "FINAL JEOPARDY!",
};

/**
 * The title card the show drops in at the top of every round, over the board.
 */
export function RoundIntro({ round, visible, reducedMotion }: RoundIntroProps) {
  const title = titles[round];
  if (!visible || !title) return null;

  return (
    <Box
      role="status"
      aria-live="polite"
      data-testid="round-intro"
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(180deg, ${jeopardyPalette.board} 0%, ${jeopardyPalette.boardShade} 100%)`,
        animation: reducedMotion ? "none" : "round-card-in 420ms ease-out both",
        "@keyframes round-card-in": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      }}
    >
      <Box
        sx={{
          fontFamily: jeopardyFonts.display,
          fontWeight: 700,
          color: jeopardyPalette.categoryText,
          textShadow: "0.05em 0.05em 0 rgba(0,0,0,0.7)",
          fontSize: "clamp(30px, 8vw, 104px)",
          letterSpacing: "0.01em",
          textAlign: "center",
          px: 2,
          transform: "skewX(-8deg)",
          animation: reducedMotion ? "none" : "round-card-zoom 520ms cubic-bezier(0.2, 0.9, 0.3, 1) both",
          "@keyframes round-card-zoom": {
            from: { transform: "skewX(-8deg) scale(0.55)", opacity: 0 },
            to: { transform: "skewX(-8deg) scale(1)", opacity: 1 },
          },
        }}
      >
        {title}
      </Box>
    </Box>
  );
}
