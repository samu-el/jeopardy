"use client";

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EmojiEventsIcon from "@mui/icons-material/EmojiEventsOutlined";
import HomeIcon from "@mui/icons-material/HomeOutlined";
import ReplayIcon from "@mui/icons-material/ReplayOutlined";
import type { PublicGameState } from "@/lib/game";

interface ResultsViewProps {
  state: PublicGameState;
  onPlayAgain: () => void;
  onExit: () => void;
}

export function ResultsView({ state, onPlayAgain, onExit }: ResultsViewProps) {
  const sorted = useMemo(() => {
    return [...state.players].sort((a, b) => b.score - a.score);
  }, [state.players]);
  const winner = sorted[0];
  const stats = state.stats;

  return (
    <Stack spacing={3}>
      <Card
        elevation={6}
        sx={{
          background:
            "linear-gradient(135deg, rgba(59,108,255,0.45), rgba(255,195,74,0.25))",
          border: "1px solid rgba(255,255,255,0.12)",
          textAlign: "center",
        }}
      >
        <CardContent sx={{ py: { xs: 4, md: 6 } }}>
          <EmojiEventsIcon sx={{ fontSize: { xs: 64, md: 96 }, color: "secondary.main" }} />
          <Typography
            variant="h2"
            sx={{
              mt: 1,
              fontWeight: 900,
              fontSize: { xs: 32, md: 56 },
              wordBreak: "break-word",
            }}
          >
            {winner?.displayName ?? "—"}
          </Typography>
          {winner ? (
            <Typography
              variant="h4"
              sx={{ mt: 1, color: "secondary.main", fontWeight: 700 }}
            >
              ${winner.score}
            </Typography>
          ) : null}
          <Stack
            direction="row"
            spacing={2}
            useFlexGap
            sx={{ mt: 4, flexWrap: "wrap", justifyContent: "center" }}
          >
            <Button
              variant="contained"
              size="large"
              startIcon={<ReplayIcon />}
              onClick={onPlayAgain}
            >
              Again
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<HomeIcon />}
              onClick={onExit}
            >
              Lobby
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1}>
            {sorted.map((player, index) => (
              <Paper
                key={player.id}
                variant="outlined"
                sx={{
                  p: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  borderColor:
                    index === 0 ? "secondary.main" : "divider",
                  backgroundColor: index === 0 ? "rgba(255,195,74,0.05)" : undefined,
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background:
                      index === 0
                        ? "secondary.main"
                        : index === 1
                          ? "rgba(255,255,255,0.12)"
                          : "rgba(255,255,255,0.06)",
                    color: index === 0 ? "#0c1224" : "text.primary",
                    fontWeight: 800,
                  }}
                >
                  {index + 1}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }}>{player.displayName}</Typography>
                </Box>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 800,
                    color: player.score < 0 ? "error.main" : "secondary.main",
                  }}
                >
                  ${player.score}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                md: `repeat(${Math.min(sorted.length, 4)}, minmax(0, 1fr))`,
              },
            }}
          >
            {sorted.map((player) => {
              const answered = stats.answeredByPlayer[player.id] ?? 0;
              const correct = stats.correctByPlayer[player.id] ?? 0;
              const incorrect = stats.incorrectByPlayer[player.id] ?? 0;
              const firstBuzzes = stats.firstBuzzByPlayer[player.id] ?? 0;
              const dailyDoubles = stats.dailyDoublesByPlayer[player.id] ?? 0;
              const accuracy = answered > 0 ? (correct / answered) * 100 : 0;
              const reactions = stats.reactionTimesByPlayer[player.id] ?? [];
              const avgReaction =
                reactions.length > 0
                  ? Math.round(
                      reactions.reduce((sum, value) => sum + value, 0) / reactions.length,
                    )
                  : null;
              return (
                <Paper key={player.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                    <Typography sx={{ fontWeight: 700, flex: 1 }}>{player.displayName}</Typography>
                    <Chip
                      size="small"
                      label={`$${player.score}`}
                      color={player.score < 0 ? "error" : "secondary"}
                    />
                  </Stack>
                  <StatLine label="Accuracy" value={`${accuracy.toFixed(0)}%`} progress={accuracy} />
                  <StatLine label="✓" value={`${correct}`} />
                  <StatLine label="✗" value={`${incorrect}`} />
                  <StatLine label="1st" value={`${firstBuzzes}`} />
                  <StatLine label="DD" value={`${dailyDoubles}`} />
                  <StatLine
                    label="ms"
                    value={avgReaction !== null ? `${avgReaction}` : "—"}
                  />
                </Paper>
              );
            })}
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}

function StatLine({
  label,
  value,
  progress,
}: {
  label: string;
  value: string;
  progress?: number;
}) {
  return (
    <Box sx={{ mt: 1 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
      </Stack>
      {progress !== undefined ? (
        <LinearProgress
          variant="determinate"
          value={Math.max(0, Math.min(100, progress))}
          sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
        />
      ) : null}
    </Box>
  );
}

