"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PublicGameState, PublicPlayerState } from "@/lib/game";
import { controls as chrome, jeopardyFonts, jeopardyPalette, ui } from "@/lib/foundation/jeopardy-style";
import { formatScore } from "@/lib/game/clue-turn";
import { useReducedMotion } from "./use-reduced-motion";

interface PodiumProps {
  player: PublicPlayerState;
  state: PublicGameState;
  isYou: boolean;
  emoji?: string;
  color?: string;
  /**
   * Buttons for the clue on screen, drawn inside the lectern. Only your own
   * gets them: the lectern is where your score is, so it is where your hand
   * already goes.
   */
  controls?: ReactNode;
  /**
   * Hold the space for those buttons whether or not this lectern has any,
   * and whether or not a clue is open.
   *
   * A lectern is one height, always. Reserving it only while a clue was up
   * meant the whole row grew the moment one opened; reserving it only on
   * your own lectern meant yours stood taller than everyone else's. The
   * space is small enough to carry all the time, which is why the buttons
   * inside it are as tight as they are.
   */
  reserveControls?: boolean;
  /**
   * Where this player stands in the ring-in order on the clue up now (1 for
   * the first), when more than one has rung in on it.
   */
  buzzPosition?: number;
}

/** Two stacked buttons and the gap above them. Kept deliberately mean:
 *  every lectern carries this whether it has buttons or not, but each key
 *  is still a 28px target, and 44px on a touch screen. */
export const podiumControlsHeight = { base: 66, coarse: 98 };

/**
 * A contestant lectern: name plate on top, the score display below, and the
 * ring-in light that flashes when they beat everyone to the buzzer.
 */
export function Podium({
  player,
  state,
  isYou,
  emoji,
  color,
  controls,
  reserveControls,
  buzzPosition,
}: PodiumProps) {
  const reducedMotion = useReducedMotion();
  const active = state.currentClue;
  const buzzedAt = active?.buzzes[player.id];
  const isBuzzed = buzzedAt !== undefined;
  const isFirstBuzzer =
    isBuzzed && Object.values(active?.buzzes ?? {}).every((time) => time >= buzzedAt);
  const judgeResult = active?.judges[player.id];
  const isPicker = state.pickerId === player.id;
  const isHost = state.settings.hostId === player.id;
  const lockedOut = (active?.lockouts[player.id] ?? 0) > state.serverTime;
  const flash = useScoreFlash(player.score);
  // A ruling keeps the light on after the room clears a wrong player's
  // ring-in, so a wrong answer shows red rather than simply going dark.
  const lit = isBuzzed || (judgeResult !== undefined && judgeResult !== null);
  const verdictLabel =
    judgeResult === true ? "Correct" : judgeResult === false ? "Wrong" : null;
  const summary = [
    isYou ? `${player.displayName} (you)` : player.displayName,
    formatScore(player.score),
    isHost ? "host" : null,
    isPicker ? "picks next" : null,
    isFirstBuzzer && judgeResult === undefined ? "rang in" : null,
    judgeResult === true ? "correct" : judgeResult === false ? "incorrect" : null,
    lockedOut ? "locked out" : null,
    player.connected ? null : "offline",
  ]
    .filter(Boolean)
    .join(", ");

  const lightColor =
    judgeResult === true
      ? jeopardyPalette.correct
      : judgeResult === false
        ? jeopardyPalette.incorrect
        : isFirstBuzzer
          ? jeopardyPalette.buzzLight
          : isBuzzed
            ? ui.inkFaint
            : "transparent";

  const accent = color ?? (isYou ? ui.blueText : ui.lineStrong);

  return (
    <Box
      data-testid={`podium-${player.id}`}
      role="group"
      aria-label={summary}
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: 190,
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        opacity: player.connected ? 1 : 0.55,
        // The first to ring in gets a white edge, the picker a gold one:
        // drawn as an outline, never a glow.
        outline: isFirstBuzzer
          ? `2px solid ${jeopardyPalette.buzzLight}`
          : isPicker
            ? `2px solid ${ui.goldBright}`
            : "2px solid transparent",
        outlineOffset: "3px",
        borderRadius: "8px",
        transition: reducedMotion ? "none" : "outline-color 120ms ease-out, opacity 200ms ease-out",
      }}
    >
      {(emoji || color) && (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            top: -16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1,
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: color ?? ui.surfaceRaised,
            border: `2px solid ${ui.stage}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
          }}
        >
          {emoji ?? ""}
        </Box>
      )}

      <Box
        sx={{
          position: "relative",
          background: ui.surface,
          borderTop: `3px solid ${accent}`,
          borderLeft: `1px solid ${ui.line}`,
          borderRight: `1px solid ${ui.line}`,
          borderBottom: `1px solid ${ui.line}`,
          borderRadius: "8px",
          px: 1,
          pt: emoji || color ? 2.25 : 1,
          pb: 1.25,
          textAlign: "center",
        }}
      >
        <Typography
          noWrap
          sx={{
            color: ui.ink,
            fontWeight: 600,
            fontSize: { xs: 13, sm: 14 },
            lineHeight: 1.3,
            mb: 0.75,
          }}
        >
          {player.displayName}
        </Typography>

        {/* Score display: white digits on black, red when in the hole. */}
        <Box
          sx={{
            ...chrome.readout,
            mx: "auto",
            py: 0.5,
            px: 1,
            minHeight: 38,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography
            data-testid={`score-${player.id}`}
            sx={{
              fontFamily: jeopardyFonts.display,
              fontWeight: 700,
              fontSize: { xs: 20, sm: 26 },
              color:
                player.score < 0
                  ? jeopardyPalette.scoreNegative
                  : jeopardyPalette.scorePositive,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              animation: flash && !reducedMotion ? `score-${flash} 620ms ease-out` : "none",
              "@media (prefers-reduced-motion: reduce)": { animation: "none" },
              "@keyframes score-up": {
                "0%": { transform: "scale(1)", color: jeopardyPalette.correct },
                "35%": { transform: "scale(1.22)", color: jeopardyPalette.correct },
                "100%": { transform: "scale(1)" },
              },
              "@keyframes score-down": {
                "0%": { transform: "translateX(0)", color: jeopardyPalette.incorrect },
                "25%": { transform: "translateX(-4px)", color: jeopardyPalette.incorrect },
                "75%": { transform: "translateX(4px)", color: jeopardyPalette.incorrect },
                "100%": { transform: "translateX(0)" },
              },
            }}
          >
            {formatScore(player.score)}
          </Typography>
        </Box>

        {reserveControls ? (
          <Box
            sx={{
              minHeight: podiumControlsHeight.base,
              "@media (pointer: coarse)": { minHeight: podiumControlsHeight.coarse },
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
            }}
          >
            {controls}
          </Box>
        ) : null}
      </Box>

      <Box
        aria-hidden
        data-testid={`buzz-light-${player.id}`}
        sx={{
          mt: 0.75,
          mx: "auto",
          width: "62%",
          height: 6,
          borderRadius: 99,
          background: lit ? lightColor : ui.line,
          transition: reducedMotion ? "none" : "background-color 120ms ease-out",
        }}
      />

      {/* Always occupies its line, whether or not this lectern has a badge
          to show. HOST or PICKS on one podium and nothing on the next made
          the two different heights in a row that should be level. */}
      <Stack
        direction="row"
        spacing={0.5}
        useFlexGap
        aria-hidden
        sx={{
          mt: 0.6,
          minHeight: 16,
          justifyContent: "center",
          flexWrap: "wrap",
          columnGap: 1,
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.3,
        }}
      >
        {isYou ? <Box sx={{ color: ui.ink, fontWeight: 700 }}>You</Box> : null}
        {buzzPosition !== undefined ? (
          <Box sx={{ color: ui.ink }}>{ordinal(buzzPosition)}</Box>
        ) : null}
        {verdictLabel ? (
          <Box
            sx={{
              color: judgeResult ? jeopardyPalette.correct : jeopardyPalette.incorrect,
              fontWeight: 700,
            }}
          >
            {judgeResult ? "\u2713 " : "\u2717 "}
            {verdictLabel}
          </Box>
        ) : null}
        {isHost ? <Box sx={{ color: ui.inkMuted }}>Host</Box> : null}
        {isPicker ? <Box sx={{ color: ui.goldBright }}>Picks</Box> : null}
        {lockedOut ? <Box sx={{ color: jeopardyPalette.incorrect }}>Locked</Box> : null}
        {player.spectator ? (
          <Box sx={{ color: ui.inkMuted }}>Spectator</Box>
        ) : null}
        {!player.connected ? (
          <Box sx={{ color: ui.inkMuted }}>Offline</Box>
        ) : null}
      </Stack>
    </Box>
  );
}

/** Returns "up"/"down" for one animation frame after the score moves. */
function useScoreFlash(score: number): "up" | "down" | null {
  const previous = useRef(score);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (score === previous.current) return;
    const direction = score > previous.current ? "up" : "down";
    previous.current = score;
    setFlash(direction);
    const id = setTimeout(() => setFlash(null), 650);
    return () => clearTimeout(id);
  }, [score]);

  return flash;
}

function ordinal(position: number): string {
  const suffix = position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th";
  return `${position}${suffix}`;
}
