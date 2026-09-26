"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PublicGameState } from "@/lib/game";
import { finalRevealEntries } from "@/lib/game/clue-turn";
import { controls, jeopardyFonts, jeopardyPalette, ui } from "@/lib/foundation/jeopardy-style";

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
            borderColor: entry.current ? jeopardyPalette.gold : undefined,
          }}
        >
          <Typography
            component="span"
            sx={{ fontFamily: jeopardyFonts.display, fontSize: 12, letterSpacing: "0.08em", color: ui.inkMuted, textTransform: "uppercase" }}
          >
            {entry.name}
          </Typography>
          <Typography component="span" sx={{ color: jeopardyPalette.goldBright, fontWeight: 700 }}>
            {entry.answer || "—"}
          </Typography>
          {entry.wager !== undefined ? (
            <Typography component="span" sx={{ fontSize: 12, color: jeopardyPalette.gold }}>
              wagered ${entry.wager}
            </Typography>
          ) : null}
          <Typography
            component="span"
            sx={{
              ml: "auto",
              fontFamily: jeopardyFonts.display,
              fontSize: 11,
              letterSpacing: "0.1em",
              fontWeight: 700,
              color:
                entry.correct === true
                  ? jeopardyPalette.correct
                  : entry.correct === false
                    ? "#FF8A93"
                    : ui.inkMuted,
            }}
          >
            {entry.correct === true
              ? "✓ CORRECT"
              : entry.correct === false
                ? "✗ WRONG"
                : entry.correct === null
                  ? "NO RULING"
                  : "BEING JUDGED"}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
