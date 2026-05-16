"use client";

import { useMemo } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SmartToyIcon from "@mui/icons-material/SmartToyOutlined";
import PersonIcon from "@mui/icons-material/PersonOutlined";
import type { PublicGameState } from "@/lib/game";

interface ScoreboardProps {
  state: PublicGameState;
  currentClientId: string;
}

interface BuzzOrder {
  rank: number;
  totalBuzzed: number;
}

export function Scoreboard({ state, currentClientId }: ScoreboardProps) {
  const buzzOrder = useMemo<Map<string, BuzzOrder>>(() => {
    const map = new Map<string, BuzzOrder>();
    const active = state.currentClue;
    if (!active) return map;
    if (active.round === "final-jeopardy") return map;
    const entries = Object.entries(active.buzzes)
      .sort(([, a], [, b]) => a - b);
    entries.forEach(([playerId], index) => {
      map.set(playerId, { rank: index, totalBuzzed: entries.length });
    });
    return map;
  }, [state.currentClue]);

  return (
    <Stack spacing={1}>
      {state.players.map((player) => {
        const isPicker = state.pickerId === player.id;
        const isYou = player.id === currentClientId;
        const buzz = buzzOrder.get(player.id);
        const isFirstBuzzer = buzz?.rank === 0;
        const isJudging = state.currentClue?.currentJudgePlayerId === player.id;
        const judgeResult = state.currentClue?.judges[player.id];

        return (
          <Paper
            key={player.id}
            variant="outlined"
            sx={{
              position: "relative",
              overflow: "hidden",
              p: { xs: 1, sm: 1.5 },
              pb: { xs: 1, sm: 1.5 },
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              borderColor: isJudging
                ? "warning.main"
                : isFirstBuzzer
                  ? "info.main"
                  : "divider",
              backgroundColor: isYou ? "rgba(59,108,255,0.08)" : "background.paper",
              transition: "border-color 0.15s ease",
            }}
          >
            <Avatar
              sx={{
                bgcolor: player.kind === "ai-bot" ? "secondary.dark" : "primary.dark",
                width: 36,
                height: 36,
              }}
            >
              {player.kind === "ai-bot" ? (
                <SmartToyIcon fontSize="small" />
              ) : (
                <PersonIcon fontSize="small" />
              )}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={0.5}
                useFlexGap
                sx={{ alignItems: "center", flexWrap: "wrap" }}
              >
                <Typography noWrap sx={{ fontWeight: 700 }}>
                  {player.displayName}
                </Typography>
                {isPicker ? (
                  <Chip size="small" label="picker" color="secondary" />
                ) : null}
                {player.spectator ? (
                  <Chip size="small" label="spectator" variant="outlined" />
                ) : null}
                {!player.connected ? (
                  <Chip size="small" label="offline" variant="outlined" />
                ) : null}
              </Stack>
              <Typography
                variant="h6"
                sx={{
                  color: player.score < 0 ? "error.main" : "secondary.main",
                  fontWeight: 800,
                }}
              >
                ${player.score}
              </Typography>
            </Box>
            <BuzzLightBar
              active={Boolean(buzz)}
              isFirst={isFirstBuzzer}
              correct={judgeResult === true}
              incorrect={judgeResult === false}
            />
          </Paper>
        );
      })}
    </Stack>
  );
}

function BuzzLightBar({
  active,
  isFirst,
  correct,
  incorrect,
}: {
  active: boolean;
  isFirst: boolean;
  correct: boolean;
  incorrect: boolean;
}) {
  if (!active) return null;
  const color = correct
    ? "success.main"
    : incorrect
      ? "error.main"
      : isFirst
        ? "info.main"
        : "secondary.main";
  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 4,
        background: (theme) => {
          const palette = theme.palette as unknown as Record<string, { main: string }>;
          const key = color.split(".")[0];
          const main = palette[key]?.main ?? color;
          return `linear-gradient(90deg, transparent, ${main}, transparent)`;
        },
        backgroundSize: "200% 100%",
        animation: "buzz-light 1.2s ease-in-out infinite",
        "@keyframes buzz-light": {
          "0%": { backgroundPosition: "100% 0" },
          "100%": { backgroundPosition: "-100% 0" },
        },
      }}
    />
  );
}
