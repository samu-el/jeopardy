"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import type { PublicGameState } from "@/lib/game";
import { judgeAnswer as fuzzyJudge } from "@/lib/ai";
import { controls, jeopardyFonts, jeopardyPalette, ui } from "@/lib/foundation/jeopardy-style";
import { Housing, HousingDivider } from "../Housing";
import { benchKeySx, wrapHousingSx } from "./bench-style";

export function JudgeBench({
  state,
  target,
  answer,
  expected,
  wager,
  onJudge,
}: {
  state: PublicGameState;
  target: string;
  answer: string;
  expected: string;
  wager?: number;
  onJudge: (correct: boolean | null) => void;
}) {
  const verdict = fuzzyJudge({ submittedAnswer: answer, expectedAnswer: expected });
  const name = state.players.find((player) => player.id === target)?.displayName ?? target;
  // The host's bench: what they said on a readout, and three keys to rule on
  // it — mounted together, the same as every other instrument on the set.
  return (
    <Housing sx={wrapHousingSx}>
      {/* On a phone the readout takes a row of its own and the keys sit
          centred under it: two balanced rows, not a ragged wrap. */}
      <Box
        sx={{
          ...controls.readout,
          display: "inline-flex",
          alignItems: "baseline",
          justifyContent: "center",
          gap: 1,
          height: 32,
          px: 1.5,
          mr: { xs: 0, sm: 0.5 },
          flexBasis: { xs: "100%", sm: "auto" },
          fontSize: 14,
          color: ui.ink,
          whiteSpace: "nowrap",
        }}
      >
        <Box component="span" sx={{ color: ui.inkMuted }}>
          {name}
        </Box>
        <Box component="span" sx={{ color: jeopardyPalette.goldBright, fontWeight: 700 }}>
          {answer || "—"}
        </Box>
        <Box
          component="span"
          sx={{
            fontSize: 11,
            fontFamily: jeopardyFonts.display,
            letterSpacing: "0.08em",
            color: verdict.correct ? jeopardyPalette.correct : jeopardyPalette.incorrect,
          }}
        >
          {Math.round(verdict.confidence * 100)}%
        </Box>
        {wager !== undefined ? (
          <Box component="span" sx={{ fontSize: 12, color: jeopardyPalette.gold }}>
            wagered ${wager}
          </Box>
        ) : null}
      </Box>
      <HousingDivider sx={{ display: { xs: "none", sm: "block" } }} />
      <Button
        size="small"
        variant="contained"
        color="success"
        onClick={() => onJudge(true)}
        sx={benchKeySx}
      >
        Correct
      </Button>
      <Button
        size="small"
        variant="contained"
        color="error"
        onClick={() => onJudge(false)}
        sx={benchKeySx}
      >
        Incorrect
      </Button>
      <Button size="small" variant="outlined" onClick={() => onJudge(null)} sx={benchKeySx}>
        Skip
      </Button>
    </Housing>
  );
}

/**
 * A bench that may need two rows on a phone: centred, with room at the
 * corners for what wraps. One row on anything wider, with the pill's ends.
 */
