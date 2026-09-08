"use client";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import type { PublicGameState } from "@/lib/game";
import type { ClientGameCommand } from "@/lib/realtime";
import {
  jeopardyClueShadow,
  jeopardyFonts,
  jeopardyPalette,
} from "@/lib/foundation/jeopardy-style";

interface TvClueProps {
  state: PublicGameState;
  /** Whether this screen may drive the board, or is only watching one. */
  canControl: boolean;
  onCommand: (command: ClientGameCommand) => void;
}

/**
 * The clue on a television: the whole panel is the button.
 *
 * Click once and the answer appears, once more and the board is back. There
 * is no timer, no buzzer and no judging here on purpose — someone is standing
 * at the screen running the game with a mouse or a fingertip, and every
 * control that isn't the clue is a control they have to aim at from across a
 * room. The phones still hold the buzzers.
 */
export function TvClue({ state, canControl, onCommand }: TvClueProps) {
  const clue = state.currentClue;
  if (!clue) return null;

  // No clue text yet means the room is still collecting a Daily Double wager.
  // Nothing to advance to, so the screen waits rather than offering a click
  // the server would only reject.
  const waiting = clue.clue === undefined;
  const answered = clue.correctResponse !== undefined;
  const clickable = canControl && !waiting;

  return (
    <ButtonBase
      data-testid="tv-clue"
      disabled={!clickable}
      aria-label={answered ? "Back to the board" : "Reveal the answer"}
      onClick={() => {
        if (!clickable) return;
        onCommand(answered ? { type: "skip" } : { type: "reveal-answer" });
      }}
      sx={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2cqw",
        px: "6cqw",
        py: "4cqw",
        textAlign: "center",
        cursor: clickable ? "pointer" : "default",
        background: `linear-gradient(180deg, ${jeopardyPalette.board} 0%, ${jeopardyPalette.boardShade} 100%)`,
      }}
    >
      <Typography
        component="span"
        data-testid="tv-clue-header"
        sx={{
          fontFamily: jeopardyFonts.display,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.55)",
          fontSize: "clamp(11px, 1.4cqw, 22px)",
        }}
      >
        {clue.category} · ${clue.value}
      </Typography>

      {waiting ? (
        <Typography
          component="span"
          sx={{
            fontFamily: jeopardyFonts.display,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: jeopardyPalette.goldBright,
            fontSize: "clamp(18px, 3cqw, 44px)",
          }}
        >
          Daily Double — waiting for the wager
        </Typography>
      ) : (
        <Typography
          component="span"
          data-testid="tv-clue-text"
          sx={{
            fontFamily: jeopardyFonts.clue,
            textTransform: "uppercase",
            fontWeight: 600,
            // Sized against the board, not the viewport, so the same clue
            // reads the same on a laptop and across a living room. Once the
            // answer is up the question steps back to a caption — the answer
            // is what the room is looking at now.
            fontSize: answered
              ? "clamp(12px, 1.8cqw, 30px)"
              : tvClueFontSize(clue.clue?.length ?? 0),
            lineHeight: 1.2,
            letterSpacing: "0.005em",
            color: answered ? "rgba(255,255,255,0.55)" : jeopardyPalette.clueText,
            textShadow: jeopardyClueShadow,
          }}
        >
          {clue.clue}
        </Typography>
      )}

      {answered ? (
        <Typography
          component="span"
          data-testid="tv-answer"
          sx={{
            fontFamily: jeopardyFonts.clue,
            textTransform: "uppercase",
            fontWeight: 700,
            fontSize: "clamp(24px, 5.4cqw, 92px)",
            lineHeight: 1.15,
            color: jeopardyPalette.goldBright,
            textShadow: jeopardyClueShadow,
          }}
        >
          {clue.correctResponse}
        </Typography>
      ) : null}

      {clickable ? (
        <Box
          component="span"
          sx={{
            position: "absolute",
            bottom: "2cqw",
            fontFamily: jeopardyFonts.display,
            textTransform: "uppercase",
            letterSpacing: "0.24em",
            fontSize: "clamp(9px, 1.1cqw, 16px)",
            color: "rgba(255,255,255,0.28)",
          }}
        >
          {answered ? "Tap for the board" : "Tap for the answer"}
        </Box>
      ) : null}
    </ButtonBase>
  );
}

/** A long clue steps down so it still fits one screen without scrolling. */
function tvClueFontSize(length: number): string {
  if (length <= 90) return "clamp(20px, 5cqw, 78px)";
  if (length <= 180) return "clamp(18px, 3.8cqw, 58px)";
  if (length <= 300) return "clamp(16px, 3cqw, 46px)";
  return "clamp(14px, 2.4cqw, 36px)";
}
