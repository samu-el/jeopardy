"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PublicGameState } from "@/lib/game";
import { finalRevealEntries } from "@/lib/game/clue-turn";
import { controls, jeopardyPalette, ui } from "@/lib/foundation/jeopardy-style";

/**
 * Final Jeopardy's reveal on a player's own screen: each contestant's answer
 * and wager as it is read out, with the ruling in words once it is made.
 */
export function FinalReveal({ state }: { state: PublicGameState }) {
  const entries = finalRevealEntries(state);
  if (entries.length === 0) return null;
  return (
    <Stack
      component="ol"
      aria-label="Final Jeopardy answers"
      data-testid="final-reveal"
      spacing={0.75}
      sx={{ listStyle: "none", m: 0, p: 0, width: "100%", maxWidth: 520 }}
    >
      {entries.map((entry) => (
        <Box
          component="li"
          key={entry.playerId}
          sx={{
            ...controls.readout,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "baseline",
            columnGap: 1.25,
            px: 1.5,
            py: 0.75,
            borderColor: entry.current ? ui.goldBright : undefined,
          }}
        >
          <Typography
            component="span"
            sx={{ fontSize: 14, fontWeight: 600, color: ui.inkMuted }}
          >
            {entry.name}
          </Typography>
          <Typography component="span" sx={{ color: jeopardyPalette.goldBright, fontWeight: 700 }}>
            {entry.answer || "No answer"}
          </Typography>
          {entry.wager !== undefined ? (
            <Typography component="span" sx={{ fontSize: 13, color: ui.goldBright }}>
              wagered ${entry.wager}
            </Typography>
          ) : null}
          <Typography
            component="span"
            sx={{
              ml: "auto",
              fontSize: 13,
              fontWeight: 700,
              color:
                entry.correct === true
                  ? jeopardyPalette.correct
                  : entry.correct === false
                    ? ui.negativeInk
                    : ui.inkMuted,
            }}
          >
            {entry.correct === true
              ? "✓ Correct"
              : entry.correct === false
                ? "✗ Wrong"
                : entry.correct === null
                  ? "No ruling"
                  : "Being judged"}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
