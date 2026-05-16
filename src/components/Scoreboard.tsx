"use client";

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

export function Scoreboard({ state, currentClientId }: ScoreboardProps) {
  return (
    <Stack spacing={1}>
      {state.players.map((player) => {
        const isPicker = state.pickerId === player.id;
        const isYou = player.id === currentClientId;
        const isBuzzed = state.currentClue?.buzzes[player.id] !== undefined;
        const isJudging = state.currentClue?.currentJudgePlayerId === player.id;
        const judgeResult = state.currentClue?.judges[player.id];

        return (
          <Paper
            key={player.id}
            variant="outlined"
            sx={{
              p: { xs: 1, sm: 1.5 },
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              borderColor: isJudging ? "warning.main" : "divider",
              backgroundColor: isYou ? "rgba(59,108,255,0.08)" : "background.paper",
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
            {isBuzzed && state.currentClue?.round !== "final-jeopardy" ? (
              <Chip
                label="buzzed"
                size="small"
                color={judgeResult === true ? "success" : judgeResult === false ? "error" : "info"}
              />
            ) : null}
          </Paper>
        );
      })}
    </Stack>
  );
}
