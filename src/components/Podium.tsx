"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PublicGameState, PublicPlayerState } from "@/lib/game";
import { jeopardyFonts, jeopardyPalette, ui } from "@/lib/foundation/jeopardy-style";

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
   * space is small enough to carry all the time — which is why the buttons
   * inside it are as tight as they are.
   */
  reserveControls?: boolean;
}

/** Two stacked buttons and the hairline above them. Kept deliberately mean:
 *  every lectern carries this whether it has buttons or not. */
export const podiumControlsHeight = 51;

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
}: PodiumProps) {
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

  const lightColor =
    judgeResult === true
      ? jeopardyPalette.correct
      : judgeResult === false
        ? jeopardyPalette.incorrect
        : isFirstBuzzer
          ? jeopardyPalette.buzzLight
          : isBuzzed
            ? "rgba(255,255,255,0.4)"
            : "transparent";

  const accent = color ?? (isYou ? jeopardyPalette.podiumEdge : ui.lineStrong);

  return (
    <Box
      data-testid={`podium-${player.id}`}
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: 190,
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        opacity: player.connected ? 1 : 0.55,
        filter: isFirstBuzzer
          ? "drop-shadow(0 0 14px rgba(255,255,255,0.5))"
          : isPicker
            ? `drop-shadow(0 0 10px ${jeopardyPalette.gold}66)`
            : "none",
        transition: "filter 160ms ease, opacity 200ms ease",
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
            background: color ?? "rgba(255,255,255,0.08)",
            border: "2px solid #000",
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
          background: `linear-gradient(180deg, ${jeopardyPalette.podium} 0%, #0A0D3A 100%)`,
          borderTop: `2px solid ${accent}`,
          borderLeft: `1px solid ${ui.line}`,
          borderRight: `1px solid ${ui.line}`,
          borderRadius: "6px 6px 2px 2px",
          px: 1,
          pt: emoji || color ? 2.25 : 1,
          pb: 1.25,
          textAlign: "center",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -2px 10px rgba(0,0,0,0.55)",
        }}
      >
        <Typography
          noWrap
          sx={{
            fontFamily: jeopardyFonts.display,
            color: "rgba(255,255,255,0.92)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 600,
            fontSize: { xs: 10, sm: 12 },
            mb: 0.75,
          }}
        >
          {player.displayName}
        </Typography>

        {/* Score display: white digits on black, red when in the hole. */}
        <Box
          sx={{
            mx: "auto",
            background: "#000",
            borderRadius: 0.5,
            border: "1px solid rgba(255,255,255,0.14)",
            py: 0.5,
            px: 1,
            minHeight: 38,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "inset 0 2px 8px rgba(0,0,0,0.9)",
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
              animation: flash ? `score-${flash} 620ms ease-out` : "none",
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
            {player.score < 0 ? `-$${Math.abs(player.score)}` : `$${player.score}`}
          </Typography>
        </Box>

        {reserveControls ? (
          <Box
            sx={{
              minHeight: podiumControlsHeight,
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
        sx={{
          height: 14,
          background: "linear-gradient(180deg, #0A0D3A 0%, #04061F 100%)",
          clipPath: "polygon(6% 0, 94% 0, 100% 100%, 0 100%)",
        }}
      />

      <Box
        aria-hidden
        data-testid={`buzz-light-${player.id}`}
        sx={{
          mt: 0.5,
          mx: "auto",
          width: "62%",
          height: 6,
          borderRadius: 99,
          background: isBuzzed ? lightColor : "rgba(255,255,255,0.05)",
          boxShadow: isBuzzed ? `0 0 16px 2px ${lightColor}` : "inset 0 0 0 1px rgba(255,255,255,0.04)",
          transition: "background 120ms ease, box-shadow 120ms ease",
          animation:
            isFirstBuzzer && judgeResult === undefined
              ? "podium-pulse 0.7s ease-in-out infinite"
              : "none",
          "@keyframes podium-pulse": {
            "0%, 100%": { opacity: 1 },
            "50%": { opacity: 0.45 },
          },
        }}
      />

      {/* Always occupies its line, whether or not this lectern has a badge
          to show. HOST or PICKS on one podium and nothing on the next made
          the two different heights in a row that should be level. */}
      <Stack
        direction="row"
        spacing={0.5}
        useFlexGap
        sx={{
          mt: 0.6,
          minHeight: 11,
          justifyContent: "center",
          flexWrap: "wrap",
          fontFamily: jeopardyFonts.display,
          letterSpacing: "0.1em",
          fontSize: 9,
        }}
      >
        {isHost ? <Box sx={{ color: jeopardyPalette.gold }}>HOST</Box> : null}
        {isPicker ? <Box sx={{ color: jeopardyPalette.goldBright }}>PICKS</Box> : null}
        {lockedOut ? <Box sx={{ color: jeopardyPalette.incorrect }}>LOCKED</Box> : null}
        {player.spectator ? (
          <Box sx={{ color: "rgba(255,255,255,0.4)" }}>SPECTATOR</Box>
        ) : null}
        {!player.connected ? (
          <Box sx={{ color: "rgba(255,255,255,0.4)" }}>OFFLINE</Box>
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
