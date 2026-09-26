"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EmojiEventsIcon from "@mui/icons-material/EmojiEventsOutlined";
import ShuffleIcon from "@mui/icons-material/ShuffleOutlined";
import ReplayIcon from "@mui/icons-material/ReplayOutlined";
import type { PublicGameState } from "@/lib/game";
import { computeResults, joinNames, ordinal } from "@/lib/game/results";
import { useGameStore } from "@/lib/state/game-store";
import { formatMoney } from "@/lib/foundation/money";
import { jeopardyFonts, jeopardyPalette, ui } from "@/lib/foundation/jeopardy-style";
import { GamePicker } from "./GamePicker";
import { lastFinalReveal } from "./use-final-reveal";

interface ResultsViewProps {
  state: PublicGameState;
  /** The same episode again, from the top, with the same players. */
  onPlayAgain: () => void;
}

/** Readable on the dark surfaces: ≥4.5:1 against `ui.surface`. */
const negativeInk = "#FF9C9C";
const winnerInk = "#1A1200";

/**
 * The end of the game: who won, the standings, and how everyone played.
 *
 * Contestants only — a television or a watcher is never listed or crowned.
 * Only the host can start the next game; everyone else is told they are
 * waiting for them, rather than shown buttons that do nothing.
 */
export function ResultsView({ state, onPlayAgain }: ResultsViewProps) {
  const selfId = useGameStore((s) => s.selfId)();
  const exitToLobby = useGameStore((s) => s.exitToLobby);
  const { standings, winners, tie } = useMemo(
    () => computeResults(state.players),
    [state.players],
  );
  const final = lastFinalReveal(state);
  const stats = state.stats;
  const isHost = !state.settings.hostId || state.settings.hostId === selfId;
  const [pickerOpen, setPickerOpen] = useState(false);
  const episodeWhenOpened = useRef<string | undefined>(undefined);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // Focus lands on the result rather than dropping to the page body.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const headline =
    winners.length === 0
      ? "Game over"
      : tie
        ? `Tie: ${joinNames(winners.map((winner) => winner.displayName))}`
        : winners[0].displayName;

  return (
    <Stack spacing={3} component="section" aria-labelledby="results-heading" data-testid="results">
      <Card
        elevation={6}
        sx={{
          background: `linear-gradient(180deg, ${jeopardyPalette.board} 0%, ${jeopardyPalette.boardShade} 100%)`,
          border: `1px solid ${ui.line}`,
          textAlign: "center",
        }}
      >
        <CardContent sx={{ py: { xs: 4, md: 6 } }}>
          <EmojiEventsIcon
            aria-hidden
            sx={{ fontSize: { xs: 56, md: 84 }, color: jeopardyPalette.goldBright }}
          />
          <Typography
            component="h1"
            id="results-heading"
            data-testid="results-winner"
            ref={headingRef}
            tabIndex={-1}
            sx={{
              mt: 1,
              fontFamily: jeopardyFonts.display,
              fontWeight: 700,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              fontSize: { xs: 32, md: 60 },
              lineHeight: 1.1,
              textShadow: "0.04em 0.04em 0 rgba(0,0,0,0.7)",
              wordBreak: "break-word",
              outline: "none",
            }}
          >
            <Box component="span" sx={visuallyHidden}>
              {winners.length === 0 ? "" : tie ? "Winners: " : "Winner: "}
            </Box>
            {headline}
          </Typography>
          {winners.length > 0 ? (
            <Typography
              data-testid="results-winner-score"
              sx={{
                mt: 1,
                fontFamily: jeopardyFonts.display,
                color: winners[0].score < 0 ? negativeInk : jeopardyPalette.goldBright,
                fontWeight: 700,
                fontSize: { xs: 26, md: 40 },
                textShadow: "0.04em 0.04em 0 rgba(0,0,0,0.7)",
              }}
            >
              {formatMoney(winners[0].score)}
            </Typography>
          ) : null}
          {isHost ? (
            <Stack
              direction="row"
              spacing={2}
              useFlexGap
              sx={{ mt: 4, flexWrap: "wrap", justifyContent: "center" }}
            >
              <Button
                variant="contained"
                size="large"
                data-testid="results-again"
                startIcon={<ReplayIcon />}
                onClick={onPlayAgain}
              >
                Play again
              </Button>
              <Button
                variant="outlined"
                size="large"
                data-testid="results-new-game"
                startIcon={<ShuffleIcon />}
                onClick={() => {
                  episodeWhenOpened.current = useGameStore.getState().lobby.loadedEpisode?.id;
                  setPickerOpen(true);
                }}
                sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.6)" }}
              >
                New game
              </Button>
            </Stack>
          ) : (
            <Typography
              role="status"
              data-testid="results-waiting"
              sx={{
                mt: 4,
                fontFamily: jeopardyFonts.display,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              Waiting for the host to start the next game…
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography component="h2" variant="h6" sx={{ mb: 1.5 }}>
            Standings
          </Typography>
          <Stack spacing={1} component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
            {standings.map((entry) => (
              <Paper
                key={entry.player.id}
                component="li"
                variant="outlined"
                data-testid={`results-row-${entry.player.id}`}
                sx={{
                  p: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  borderColor: entry.winner ? ui.gold : "divider",
                  backgroundColor: entry.winner ? ui.goldTint : undefined,
                }}
              >
                <Box
                  aria-hidden
                  data-testid={`results-rank-${entry.player.id}`}
                  sx={{
                    width: 36,
                    height: 36,
                    flexShrink: 0,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: entry.winner ? ui.gold : ui.surfaceRaised,
                    color: entry.winner ? winnerInk : ui.ink,
                    border: entry.winner ? "none" : `1px solid ${ui.lineStrong}`,
                    fontWeight: 800,
                  }}
                >
                  {entry.rank}
                </Box>
                <Box component="span" sx={visuallyHidden}>
                  {ordinal(entry.rank)}
                  {entry.winner ? ", winner" : ""}:
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                    {entry.player.displayName}
                    {entry.tied ? (
                      <Typography component="span" sx={{ ml: 1, color: ui.inkMuted, fontSize: 13 }}>
                        tied
                      </Typography>
                    ) : null}
                  </Typography>
                </Box>
                <Typography
                  variant="h5"
                  component="span"
                  sx={{
                    fontWeight: 800,
                    color: entry.player.score < 0 ? negativeInk : ui.gold,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatMoney(entry.player.score)}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {final && final.rows.length > 0 ? (
        <Card variant="outlined" data-testid="results-final">
          <CardContent>
            <Typography component="h2" variant="h6">
              Final Jeopardy
            </Typography>
            <Typography sx={{ color: ui.inkMuted, mb: 1.5 }}>
              {final.category}
              {final.correctResponse ? ` · ${final.correctResponse}` : ""}
            </Typography>
            <Stack spacing={1}>
              {final.rows.map((row) => (
                <Stack
                  key={row.playerId}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={{ xs: 0.25, sm: 2 }}
                  sx={{ alignItems: { sm: "baseline" } }}
                >
                  <Typography sx={{ fontWeight: 700, minWidth: 140 }}>{row.displayName}</Typography>
                  <Typography sx={{ flex: 1, overflowWrap: "anywhere" }}>
                    {row.answer?.trim() ? `“${row.answer}”` : "(no response)"}
                    {row.verdict === true ? " · Correct" : row.verdict === false ? " · Incorrect" : ""}
                  </Typography>
                  <Typography sx={{ color: ui.inkMuted, fontVariantNumeric: "tabular-nums" }}>
                    {row.wager !== undefined ? `Wagered ${formatMoney(row.wager)} · ` : ""}
                    {formatMoney(row.scoreBefore)} → {formatMoney(row.scoreAfter)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Card variant="outlined">
        <CardContent>
          <Typography component="h2" variant="h6" sx={{ mb: 1.5 }}>
            How everyone played
          </Typography>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              // Cards keep a readable width: one player is one card, centred,
              // not a strip across the whole screen.
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 320px))",
              justifyContent: "center",
            }}
          >
            {standings.map(({ player }) => {
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
                <Paper
                  key={player.id}
                  variant="outlined"
                  sx={{ p: 2 }}
                  data-testid={`results-stats-${player.id}`}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                    <Typography component="h3" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }}>
                      {player.displayName}
                    </Typography>
                    <Box
                      component="span"
                      data-testid={`results-chip-${player.id}`}
                      sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: 99,
                        fontSize: 13,
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                        bgcolor: player.score < 0 ? "transparent" : ui.gold,
                        color: player.score < 0 ? negativeInk : winnerInk,
                        border: player.score < 0 ? `1px solid ${negativeInk}` : "none",
                      }}
                    >
                      {formatMoney(player.score)}
                    </Box>
                  </Stack>
                  <StatLine
                    label="Accuracy"
                    value={`${accuracy.toFixed(0)}%`}
                    progress={accuracy}
                    progressLabel={`${player.displayName} accuracy`}
                  />
                  <StatLine label="Correct" value={`${correct}`} />
                  <StatLine label="Incorrect" value={`${incorrect}`} />
                  <StatLine label="First to buzz" value={`${firstBuzzes}`} />
                  <StatLine label="Daily Doubles" value={`${dailyDoubles}`} />
                  <StatLine
                    label="Avg reaction"
                    value={avgReaction !== null ? `${avgReaction} ms` : "—"}
                  />
                </Paper>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      <GamePicker
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          // The picker closes itself once an episode is chosen. A different
          // episode than before means "deal this one": into the lobby with
          // the same players, the same way Change game + Restart does it.
          const chosen = useGameStore.getState().lobby.loadedEpisode?.id;
          if (chosen && chosen !== episodeWhenOpened.current) exitToLobby();
        }}
      />
    </Stack>
  );
}

const visuallyHidden = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;

function StatLine({
  label,
  value,
  progress,
  progressLabel,
}: {
  label: string;
  value: string;
  progress?: number;
  progressLabel?: string;
}) {
  return (
    <Box sx={{ mt: 1 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="body2" sx={{ color: ui.inkMuted }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
      </Stack>
      {progress !== undefined ? (
        <LinearProgress
          variant="determinate"
          aria-label={progressLabel ?? label}
          value={Math.max(0, Math.min(100, progress))}
          sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
        />
      ) : null}
    </Box>
  );
}
