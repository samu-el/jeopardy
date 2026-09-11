"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PublicGameState } from "@/lib/game";
import { useGameStore } from "@/lib/state/game-store";
import {
  playSfx,
  startFinalTheme,
  stopFinalTheme,
} from "@/lib/ai";
import {
  jeopardyClueShadow,
  jeopardyFonts,
  jeopardyPalette,
} from "@/lib/foundation/jeopardy-style";
import { DailyDoubleSplash } from "./DailyDoubleSplash";

interface ClueStageProps {
  state: PublicGameState;
}

/**
 * The clue itself, and nothing anyone presses.
 *
 * The category, the value, the clue, and the answer once it is revealed —
 * what the whole room is reading. The clock, the buzzer, the answer field
 * and the host's controls sit under the board in `ClueControls`, so a long
 * clue has the panel to itself and the board stops being a control surface.
 */
export function ClueStage({ state }: ClueStageProps) {
  const preferences = useGameStore((s) => s.preferences);
  const currentClue = state.currentClue;

  const activeClueId = currentClue?.clueId ?? null;
  const [trackedClueId, setTrackedClueId] = useState<string | null>(null);
  const [ddSplashId, setDdSplashId] = useState<string | null>(null);
  const [ddSplashVisible, setDdSplashVisible] = useState(false);
  if (trackedClueId !== activeClueId) {
    setTrackedClueId(activeClueId);
  }

  // Daily Double splash while the wager is open, before the clue is read.
  const shouldTriggerDdSplash =
    Boolean(currentClue?.dailyDouble) &&
    currentClue?.waitingForWager.length !== 0 &&
    ddSplashId !== (currentClue?.clueId ?? null);
  if (shouldTriggerDdSplash && currentClue) {
    setDdSplashId(currentClue.clueId);
    setDdSplashVisible(true);
    if (preferences.soundEnabled) playSfx("daily-double");
  }
  useEffect(() => {
    if (!ddSplashVisible) return;
    const id = setTimeout(() => setDdSplashVisible(false), 1_600);
    return () => clearTimeout(id);
  }, [ddSplashVisible]);

  // Final Jeopardy countdown — runs while the clue is live, stops on reveal.
  const finalThemeArmed = useRef<string | null>(null);
  const isFinal = currentClue?.round === "final-jeopardy";
  const answerRevealed = currentClue?.correctResponse !== undefined;
  useEffect(() => {
    if (!currentClue || !isFinal || answerRevealed || !preferences.soundEnabled) {
      if (!currentClue || answerRevealed) {
        stopFinalTheme();
        finalThemeArmed.current = null;
      }
      return;
    }
    if (finalThemeArmed.current === currentClue.clueId) return;
    finalThemeArmed.current = currentClue.clueId;
    startFinalTheme(30);
  }, [currentClue, isFinal, answerRevealed, preferences.soundEnabled]);

  useEffect(() => () => stopFinalTheme(), []);


  if (!currentClue) return null;

  return (
    <Box
      data-testid="clue-stage"
      sx={{
        flex: 1,
        width: "100%",
        // A column of three parts: header, the clue, and the controls. Only
        // the clue may grow, and it scrolls inside its own space so a long
        // one never pushes the lights or the buzzer off the panel.
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
        position: "relative",
        px: { xs: 1.5, md: 5 },
        py: { xs: 1.5, md: 2 },
        gap: { xs: 0.5, md: 1 },
        background: `linear-gradient(180deg, ${jeopardyPalette.board} 0%, ${jeopardyPalette.boardShade} 100%)`,
      }}
    >
      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 1,
          flexShrink: 0,
        }}
      >
        <Typography
          sx={{
            fontFamily: jeopardyFonts.display,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.72)",
            fontSize: { xs: 11, sm: 14 },
          }}
        >
          {currentClue.category}
        </Typography>
        <Typography
          sx={{
            fontFamily: jeopardyFonts.display,
            color: jeopardyPalette.gold,
            fontWeight: 700,
            fontSize: { xs: 14, sm: 20 },
            textShadow: jeopardyClueShadow,
          }}
        >
          {currentClue.dailyDouble
            ? `DAILY DOUBLE${
                currentClue.wagers[currentClue.dailyDoublePlayerId ?? ""] !== undefined
                  ? ` · $${currentClue.wagers[currentClue.dailyDoublePlayerId ?? ""]}`
                  : ""
              }`
            : isFinal
              ? "FINAL JEOPARDY!"
              : `$${currentClue.value}`}
        </Typography>
      </Stack>

      <DailyDoubleSplash
        visible={ddSplashVisible}
        reducedMotion={preferences.reducedMotion}
      />

      <Box
        data-testid="clue-body"
        sx={{
          flex: "1 1 auto",
          // `minHeight: 0` is what actually lets this shrink: without it a
          // flex item refuses to go below its content height and overruns
          // everything below.
          minHeight: 0,
          overflowY: "auto",
          py: { xs: 1, md: 2 },
        }}
      >
        {/*
          Centring happens on this inner box, not on the scroll container: a
          flex parent with `align-items: center` pushes an over-tall child out
          of *both* ends, where the top can never be scrolled back into view.
        */}
        <Box
          sx={{
            minHeight: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
        {currentClue.clue ? (
          <Typography
            component="p"
            data-testid="clue-text"
            sx={{
              fontFamily: jeopardyFonts.clue,
              color: jeopardyPalette.clueText,
              textTransform: "uppercase",
              fontWeight: 600,
              textShadow: jeopardyClueShadow,
              // The show sets a long clue smaller so it still fits the
              // monitor; the size steps down with the character count.
              fontSize: clueFontSize(currentClue.clue.length),
              lineHeight: 1.22,
              // A long clue also gets a wider measure: more words per line
              // means fewer lines, so it stays on one screen.
              maxWidth: clueMeasure(currentClue.clue.length),
              letterSpacing: "0.005em",
              animation: preferences.reducedMotion ? "none" : "clue-in 260ms ease-out both",
              "@keyframes clue-in": {
                from: { opacity: 0 },
                to: { opacity: 1 },
              },
            }}
          >
            {currentClue.clue}
          </Typography>
        ) : (
          <Typography
            sx={{
              fontFamily: jeopardyFonts.display,
              color: "rgba(255,255,255,0.65)",
              fontSize: { xs: 16, md: 24 },
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {currentClue.waitingForWager.length > 0
              ? `Wager · ${currentClue.waitingForWager
                  .map((id) => playerName(state, id))
                  .join(", ")}`
              : ""}
          </Typography>
        )}
        </Box>
      </Box>

      <Box sx={{ flexShrink: 0 }}>
      {answerRevealed ? (
        <Typography
          data-testid="correct-response"
          sx={{
            fontFamily: jeopardyFonts.clue,
            textAlign: "center",
            color: jeopardyPalette.goldBright,
            textTransform: "uppercase",
            fontWeight: 700,
            fontSize: "clamp(16px, 2.4vw, 34px)",
            textShadow: jeopardyClueShadow,
            mb: 1.5,
            animation: preferences.reducedMotion ? "none" : "clue-in 220ms ease-out both",
          }}
        >
          {currentClue.correctResponse}
        </Typography>
      ) : null}

      </Box>
    </Box>
  );
}

/**
 * Clue type sizes down as the clue gets longer, the way the show sets a wordy
 * clue smaller rather than letting it overrun the monitor. Sized against the
 * board container so it tracks the panel, not the viewport.
 */
function clueFontSize(length: number): string {
  if (length <= 90) return "clamp(18px, 4.2cqw, 46px)";
  if (length <= 180) return "clamp(16px, 3.2cqw, 36px)";
  if (length <= 300) return "clamp(15px, 2.5cqw, 29px)";
  return "clamp(13px, 2cqw, 24px)";
}

function clueMeasure(length: number): string {
  if (length <= 90) return "22ch";
  if (length <= 180) return "30ch";
  if (length <= 300) return "38ch";
  return "46ch";
}

function playerName(state: PublicGameState, id: string) {
  return state.players.find((player) => player.id === id)?.displayName ?? id;
}
