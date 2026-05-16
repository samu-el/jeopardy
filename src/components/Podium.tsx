"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PublicGameState, PublicPlayerState } from "@/lib/game";

interface PodiumProps {
  player: PublicPlayerState;
  state: PublicGameState;
  isYou: boolean;
  emoji?: string;
  color?: string;
}

export function Podium({ player, state, isYou, emoji, color }: PodiumProps) {
  const active = state.currentClue;
  const buzzedAt = active?.buzzes[player.id];
  const isBuzzed = buzzedAt !== undefined;
  const isFirstBuzzer =
    isBuzzed &&
    Object.values(active?.buzzes ?? {}).every((time) => time >= buzzedAt);
  const judgeResult = active?.judges[player.id];
  const isPicker = state.pickerId === player.id;

  const lightColor =
    judgeResult === true
      ? "#33d684"
      : judgeResult === false
        ? "#ff5a6e"
        : isFirstBuzzer
          ? "#5b8cff"
          : isBuzzed
            ? "rgba(255,255,255,0.4)"
            : "transparent";

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: 180,
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        filter: isPicker ? "drop-shadow(0 0 12px rgba(255,210,59,0.45))" : "none",
      }}
    >
      {/* Avatar disc above the plate */}
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
            border: "2px solid #0c0c10",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
          }}
        >
          {emoji ?? ""}
        </Box>
      )}

      {/* Front face — main pillar with name and score */}
      <Box
        sx={{
          position: "relative",
          background: isYou
            ? "linear-gradient(180deg, #1b3792 0%, #0a1949 100%)"
            : "linear-gradient(180deg, #1a2b6e 0%, #07103a 100%)",
          borderTop: "2px solid",
          borderLeft: "1px solid",
          borderRight: "1px solid",
          borderColor: isPicker ? "#ffd23b" : color ?? "rgba(255,255,255,0.16)",
          borderRadius: "12px 12px 4px 4px",
          px: 1.25,
          pt: emoji || color ? 2.25 : 1,
          pb: 1.5,
          textAlign: "center",
          // Subtle inner highlight to feel like the show's gloss
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -2px 8px rgba(0,0,0,0.5)",
        }}
      >
        <Typography
          noWrap
          sx={{
            color: "rgba(255,255,255,0.92)",
            textTransform: "uppercase",
            letterSpacing: 0.6,
            fontWeight: 700,
            fontSize: { xs: 10, sm: 11 },
            mb: 0.75,
            lineHeight: 1.2,
          }}
        >
          {player.displayName}
        </Typography>

        {/* Score plate — dark inset rectangle with yellow digital-style numerals */}
        <Box
          sx={{
            mx: "auto",
            background: "#04081d",
            borderRadius: 1,
            border: "1px solid rgba(255,210,59,0.18)",
            py: 0.6,
            px: 1,
            minHeight: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "inset 0 2px 6px rgba(0,0,0,0.7)",
          }}
        >
          <Typography
            sx={{
              fontWeight: 900,
              fontSize: { xs: 20, sm: 26 },
              color: player.score < 0 ? "#ff7a8a" : "#ffd23b",
              lineHeight: 1,
              letterSpacing: -0.5,
              textShadow: "0 0 6px rgba(255,210,59,0.35)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ${player.score}
          </Typography>
        </Box>
      </Box>

      {/* Angled base — gives it the lectern silhouette */}
      <Box
        aria-hidden
        sx={{
          height: 14,
          background: isYou
            ? "linear-gradient(180deg, #0a1949 0%, #050a26 100%)"
            : "linear-gradient(180deg, #07103a 0%, #02061b 100%)",
          clipPath: "polygon(6% 0, 94% 0, 100% 100%, 0 100%)",
          borderBottomLeftRadius: 2,
          borderBottomRightRadius: 2,
        }}
      />

      {/* Buzzer status light */}
      <Box
        aria-hidden
        sx={{
          mt: 0.5,
          mx: "auto",
          width: "60%",
          height: 6,
          borderRadius: 99,
          background: isBuzzed ? lightColor : "rgba(255,255,255,0.05)",
          boxShadow: isBuzzed
            ? `0 0 16px 2px ${lightColor}`
            : "inset 0 0 0 1px rgba(255,255,255,0.04)",
          transition: "background 0.15s ease, box-shadow 0.15s ease",
          animation:
            isFirstBuzzer && judgeResult === undefined
              ? "podium-pulse 0.9s ease-in-out infinite"
              : "none",
          "@keyframes podium-pulse": {
            "0%, 100%": { opacity: 1 },
            "50%": { opacity: 0.5 },
          },
        }}
      />

      <Stack
        direction="row"
        spacing={0.5}
        useFlexGap
        sx={{ mt: 0.75, justifyContent: "center", flexWrap: "wrap" }}
      >
        {isPicker ? (
          <Box
            sx={{
              fontSize: 9,
              color: "#ffd23b",
              letterSpacing: 1,
              fontWeight: 700,
            }}
          >
            PICKER
          </Box>
        ) : null}
        {player.spectator ? (
          <Box sx={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>SPECTATOR</Box>
        ) : null}
        {!player.connected ? (
          <Box sx={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>OFFLINE</Box>
        ) : null}
      </Stack>
    </Box>
  );
}
