"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SmartToyIcon from "@mui/icons-material/SmartToyOutlined";
import PersonIcon from "@mui/icons-material/PersonOutlined";
import type { PublicGameState, PublicPlayerState } from "@/lib/game";

interface PodiumProps {
  player: PublicPlayerState;
  state: PublicGameState;
  isYou: boolean;
}

export function Podium({ player, state, isYou }: PodiumProps) {
  const active = state.currentClue;
  const buzzedAt = active?.buzzes[player.id];
  const isBuzzed = buzzedAt !== undefined;
  const isFirstBuzzer =
    isBuzzed &&
    Object.values(active?.buzzes ?? {}).every((time) => time >= buzzedAt);
  const judgeResult = active?.judges[player.id];
  const isPicker = state.pickerId === player.id;

  const lightColor = judgeResult === true
    ? "#33d684"
    : judgeResult === false
      ? "#ff5a6e"
      : isFirstBuzzer
        ? "#5b8cff"
        : isBuzzed
          ? "#888"
          : "transparent";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        minWidth: 0,
      }}
    >
      {/* Score plate */}
      <Box
        sx={{
          background: isYou
            ? "linear-gradient(180deg, #122042 0%, #0a142e 100%)"
            : "linear-gradient(180deg, #1c1c20 0%, #0c0c10 100%)",
          border: "1px solid",
          borderColor: isPicker ? "#ffd23b" : "rgba(255,255,255,0.08)",
          borderRadius: 2,
          p: { xs: 1, sm: 1.5 },
          textAlign: "center",
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", justifyContent: "center", mb: 0.5 }}
        >
          {player.kind === "ai-bot" ? (
            <SmartToyIcon fontSize="small" sx={{ color: "rgba(255,255,255,0.5)" }} />
          ) : (
            <PersonIcon fontSize="small" sx={{ color: "rgba(255,255,255,0.5)" }} />
          )}
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: { xs: 12, sm: 14 },
              color: "white",
            }}
            noWrap
          >
            {player.displayName}
          </Typography>
        </Stack>
        <Typography
          sx={{
            fontWeight: 900,
            fontSize: { xs: 22, sm: 30 },
            color: player.score < 0 ? "#ff5a6e" : "#ffd23b",
            lineHeight: 1.1,
            fontFamily: "Inter, system-ui, sans-serif",
            letterSpacing: -1,
          }}
        >
          ${player.score}
        </Typography>
      </Box>

      {/* Buzzer light */}
      <Box
        aria-hidden
        sx={{
          mt: 0.5,
          height: 8,
          borderRadius: 99,
          background: isBuzzed
            ? lightColor
            : "rgba(255,255,255,0.04)",
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
            "50%": { opacity: 0.55 },
          },
        }}
      />
    </Box>
  );
}
