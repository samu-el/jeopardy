"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PublicGameState } from "@/lib/game";
import { useGameStore } from "@/lib/state/game-store";
import { playSfx, startFinalTheme, stopFinalTheme } from "@/lib/ai";
import {
  boardGradient,
  clueScale,
  clueType,
  displayType,
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
  const clue = state.currentClue;
  const isFinal = clue?.round === "final-jeopardy";
  const answerRevealed = clue?.correctResponse !== undefined;
  const splashVisible = useDailyDoubleSplash(state, preferences.soundEnabled);
  useFinalTheme(state, preferences.soundEnabled);

  if (!clue) return null;

  const headline = clue.dailyDouble
    ? dailyDoubleHeadline(clue.wagers[clue.dailyDoublePlayerId ?? ""])
    : isFinal
      ? "FINAL JEOPARDY!"
      : `$${clue.value}`;
  const scale = clueScale(clue.clue?.length ?? 0);

  return (
    <Box
      data-testid="clue-stage"
      sx={{
        // A column of three parts: header, the clue, and the answer. Only the
        // clue may grow, and it scrolls inside its own space so a long one
        // never pushes anything off the panel.
        flex: 1,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
        position: "relative",
        px: { xs: 1.5, md: 5 },
        py: { xs: 1.5, md: 2 },
        gap: { xs: 0.5, md: 1 },
        background: boardGradient,
      }}
    >
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "baseline", gap: 1, flexShrink: 0 }}
      >
        <Typography
          sx={displayType({ color: "rgba(255,255,255,0.72)", fontSize: { xs: 11, sm: 14 } })}
        >
          {clue.category}
        </Typography>
        <Typography
          sx={displayType({
            color: jeopardyPalette.gold,
            fontWeight: 700,
            fontSize: { xs: 14, sm: 20 },
            textShadow: "0.06em 0.06em 0 rgba(0,0,0,0.85)",
          })}
        >
          {headline}
        </Typography>
      </Stack>

      <DailyDoubleSplash visible={splashVisible} reducedMotion={preferences.reducedMotion} />

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
          {clue.clue ? (
            <Typography
              component="p"
              data-testid="clue-text"
              sx={clueType({
                color: jeopardyPalette.clueText,
                fontSize: scale.panel,
                maxWidth: scale.measure,
                lineHeight: 1.22,
                letterSpacing: "0.005em",
                animation: preferences.reducedMotion ? "none" : "clue-in 260ms ease-out both",
                "@keyframes clue-in": { from: { opacity: 0 }, to: { opacity: 1 } },
              })}
            >
              {clue.clue}
            </Typography>
          ) : (
            <Typography
              sx={displayType({
                color: "rgba(255,255,255,0.65)",
                fontSize: { xs: 16, md: 24 },
                letterSpacing: "0.1em",
              })}
            >
              {clue.waitingForWager.length > 0
                ? `Wager · ${clue.waitingForWager.map((id) => playerName(state, id)).join(", ")}`
                : ""}
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ flexShrink: 0 }}>
        {answerRevealed ? (
          <Typography
            data-testid="correct-response"
            sx={clueType({
              textAlign: "center",
              color: jeopardyPalette.goldBright,
              fontWeight: 700,
              // Never smaller than the clue it answers, phone included.
              fontSize: `max(clamp(16px, 2.4vw, 34px), ${scale.panel})`,
              mb: 1.5,
              animation: preferences.reducedMotion ? "none" : "clue-in 220ms ease-out both",
            })}
          >
            {clue.correctResponse}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}

function dailyDoubleHeadline(wager: number | undefined): string {
  return wager === undefined ? "DAILY DOUBLE" : `DAILY DOUBLE · $${wager}`;
}

/** Flashes the splash once per Daily Double, while its wager is open. */
function useDailyDoubleSplash(state: PublicGameState, soundEnabled: boolean): boolean {
  const clue = state.currentClue;
  const [splashedClueId, setSplashedClueId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  if (
    clue?.dailyDouble &&
    clue.waitingForWager.length !== 0 &&
    splashedClueId !== clue.clueId
  ) {
    setSplashedClueId(clue.clueId);
    setVisible(true);
    if (soundEnabled) playSfx("daily-double");
  }

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => setVisible(false), 1_600);
    return () => clearTimeout(id);
  }, [visible]);

  return visible;
}

/** The Final Jeopardy countdown: runs while the clue is live, stops on reveal. */
function useFinalTheme(state: PublicGameState, soundEnabled: boolean) {
  const clue = state.currentClue;
  const armedFor = useRef<string | null>(null);
  const live =
    clue !== undefined &&
    clue.round === "final-jeopardy" &&
    clue.correctResponse === undefined &&
    soundEnabled;

  useEffect(() => {
    if (!live) {
      if (!clue || clue.correctResponse !== undefined) {
        stopFinalTheme();
        armedFor.current = null;
      }
      return;
    }
    if (armedFor.current === clue.clueId) return;
    armedFor.current = clue.clueId;
    startFinalTheme(30);
  }, [clue, live]);

  useEffect(() => () => stopFinalTheme(), []);
}

function playerName(state: PublicGameState, id: string) {
  return state.players.find((player) => player.id === id)?.displayName ?? id;
}
