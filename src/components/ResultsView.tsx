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
import type { GameStats, PublicGameState } from "@/lib/game";

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
  const reactionAverages = useMemo(
    () => computeReactionAverages(stats),
    [stats],
  );
  const topReaction = useMemo(() => {
    return Object.entries(reactionAverages)
      .filter(([, avg]) => Number.isFinite(avg))
      .sort(([, a], [, b]) => a - b)[0];
  }, [reactionAverages]);

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
          <Typography variant="overline" sx={{ display: "block", color: "secondary.light" }}>
            Final scores
          </Typography>
          <Typography
            variant="h2"
            sx={{
              mt: 1,
              fontWeight: 900,
              fontSize: { xs: 32, md: 56 },
              wordBreak: "break-word",
            }}
          >
            {winner ? `${winner.displayName} wins` : "Game complete"}
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
              Play again
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<HomeIcon />}
              onClick={onExit}
            >
              Back to lobby
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Leaderboard
          </Typography>
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
                  <Typography variant="caption" color="text.secondary">
                    {player.kind === "ai-bot" ? "AI bot" : "Human"}
                  </Typography>
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
          <Typography variant="h5" sx={{ mb: 2 }}>
            Round stats
          </Typography>
          <Stack spacing={2}>
            <SummaryRow label="Questions started" value={String(stats.questionsStarted)} />
            {topReaction ? (
              <SummaryRow
                label="Fastest average buzz"
                value={`${state.players.find((p) => p.id === topReaction[0])?.displayName ?? topReaction[0]} — ${Math.round(topReaction[1])} ms`}
              />
            ) : null}
          </Stack>

          <Box
            sx={{
              mt: 3,
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
                  <StatLine label="Correct" value={`${correct}`} />
                  <StatLine label="Incorrect" value={`${incorrect}`} />
                  <StatLine label="First buzzes" value={`${firstBuzzes}`} />
                  <StatLine label="Daily Doubles" value={`${dailyDoubles}`} />
                  <StatLine
                    label="Avg buzz"
                    value={avgReaction !== null ? `${avgReaction} ms` : "—"}
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
      <Typography sx={{ color: "text.secondary", minWidth: 180 }}>{label}</Typography>
      <Typography sx={{ fontWeight: 700 }}>{value}</Typography>
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

function computeReactionAverages(stats: GameStats): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [playerId, times] of Object.entries(stats.reactionTimesByPlayer)) {
    if (!times || times.length === 0) continue;
    result[playerId] = times.reduce((sum, value) => sum + value, 0) / times.length;
  }
  return result;
}
