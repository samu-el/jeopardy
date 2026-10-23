"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EmojiEventsIcon from "@mui/icons-material/EmojiEventsOutlined";
import ShuffleIcon from "@mui/icons-material/ShuffleOutlined";
import ReplayIcon from "@mui/icons-material/ReplayOutlined";
import type { PublicGameState } from "@/lib/game";
import { getFinalRecord } from "@/lib/game/final-reveal";
import { computeResults, joinNames, ordinal } from "@/lib/game/results";
import { useGameStore } from "@/lib/state/game-store";
import { formatMoney } from "@/lib/foundation/money";
import {
  boardGradient,
  jeopardyFonts,
  jeopardyPalette,
  jeopardyTextShadow,
  ui,
} from "@/lib/foundation/jeopardy-style";
import { GamePicker } from "./GamePicker";

interface ResultsViewProps {
  state: PublicGameState;
  /** The same episode again, from the top, with the same players. */
  onPlayAgain: () => void;
}

/**
 * The end of the game: who won, the standings, and how everyone played.
 *
 * Contestants only: a television or a watcher is never listed or crowned.
 * Only the host can start the next game; everyone else is told they are
 * waiting for them, rather than shown buttons that do nothing.
 *
 * One band for the winner on the board blue, then the record as tables:
 * the standings, Final Jeopardy, and the numbers behind each score.
 */
export function ResultsView({ state, onPlayAgain }: ResultsViewProps) {
  const selfId = useGameStore((s) => s.selfId)();
  const exitToLobby = useGameStore((s) => s.exitToLobby);
  const { standings, winners, tie } = useMemo(() => computeResults(state), [state]);
  const final = getFinalRecord(state);
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
      ? "No winner"
      : tie
        ? `Tie: ${joinNames(winners.map((winner) => winner.displayName))}`
        : winners[0].displayName;

  return (
    <Stack
      spacing={5}
      component="section"
      aria-labelledby="results-heading"
      data-testid="results"
      sx={{ pb: 6 }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "auto minmax(0, 1fr) auto" },
          alignItems: "center",
          columnGap: 4,
          rowGap: 2,
          px: { xs: 3, md: 5 },
          py: { xs: 4, md: 5 },
          borderRadius: `${ui.radiusPanel}px`,
          background: boardGradient,
          textAlign: { xs: "center", md: "left" },
        }}
      >
        <EmojiEventsIcon
          aria-hidden
          sx={{
            fontSize: { xs: 56, md: 88 },
            color: jeopardyPalette.goldBright,
            justifySelf: "center",
          }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h1"
            id="results-heading"
            data-testid="results-winner"
            ref={headingRef}
            tabIndex={-1}
            sx={{
              fontFamily: jeopardyFonts.display,
              fontWeight: 700,
              letterSpacing: "0.01em",
              textTransform: "uppercase",
              fontSize: { xs: 36, md: 64 },
              lineHeight: 1.02,
              color: ui.onBoard,
              textShadow: jeopardyTextShadow,
              overflowWrap: "break-word",
              minWidth: 0,
              outline: "none",
            }}
          >
            <Box component="span" sx={visuallyHidden}>
              {winners.length === 0 ? "Result: " : tie ? "Winners: " : "Winner: "}
            </Box>
            {headline}
          </Typography>
          {winners.length > 0 ? (
            <Typography
              data-testid="results-winner-score"
              sx={{
                mt: 1,
                fontFamily: jeopardyFonts.display,
                color: jeopardyPalette.goldBright,
                fontWeight: 700,
                fontSize: { xs: 28, md: 40 },
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                textShadow: jeopardyTextShadow,
              }}
            >
              {formatMoney(winners[0].score)}
            </Typography>
          ) : null}
        </Box>
        {isHost ? (
          <Stack
            direction={{ xs: "column", sm: "row", md: "column" }}
            spacing={1.5}
            useFlexGap
            sx={{ justifyContent: "center", alignItems: "stretch" }}
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
                episodeWhenOpened.current =
                  useGameStore.getState().lobby.loadedEpisode?.id;
                setPickerOpen(true);
              }}
            >
              New game
            </Button>
          </Stack>
        ) : (
          <Typography
            role="status"
            data-testid="results-waiting"
            sx={{
              color: ui.onBoardMuted,
              fontWeight: 600,
              maxWidth: "28ch",
              justifySelf: "center",
            }}
          >
            Waiting for the host to start the next game…
          </Typography>
        )}
      </Box>

      <ResultsSection title="Standings">
        <ResultsTable head={["", "Player", "Score"]} align={["left", "left", "right"]}>
          {standings.map((entry) => {
            const { player } = entry;
            return (
              <Box
                component="tr"
                key={player.id}
                data-testid={`results-row-${entry.player.id}`}
              >
                <Box component="td" sx={{ ...cellSx, width: 56 }}>
                  <Box
                    aria-hidden
                    data-testid={`results-rank-${entry.player.id}`}
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: entry.winner ? ui.goldBright : "transparent",
                      color: entry.winner ? ui.onGold : ui.inkMuted,
                      border: entry.winner ? "none" : `1px solid ${ui.lineStrong}`,
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {entry.rank}
                  </Box>
                  <Box component="span" sx={visuallyHidden}>
                    {ordinal(entry.rank)}
                    {entry.winner ? ", winner" : ""}
                  </Box>
                </Box>
                <Box
                  component="td"
                  sx={{ ...cellSx, fontWeight: 700, overflowWrap: "anywhere" }}
                >
                  {entry.player.displayName}
                  {entry.tied ? (
                    <Box
                      component="span"
                      sx={{ ml: 1, color: ui.inkMuted, fontWeight: 400, fontSize: 14 }}
                    >
                      tied
                    </Box>
                  ) : null}
                </Box>
                <Box component="td" sx={{ ...cellSx, textAlign: "right" }}>
                  <Box
                    component="span"
                    data-testid={`results-chip-${player.id}`}
                    sx={{
                      fontFamily: jeopardyFonts.display,
                      fontWeight: 700,
                      fontSize: 23,
                      fontVariantNumeric: "tabular-nums",
                      color:
                        entry.player.score < 0
                          ? ui.negativeInk
                          : entry.winner
                            ? ui.goldBright
                            : ui.ink,
                    }}
                  >
                    {formatMoney(entry.player.score)}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </ResultsTable>
      </ResultsSection>

      {final && final.rows.length > 0 ? (
        <ResultsSection
          title="Final Jeopardy"
          data-testid="results-final"
          meta={[final.category, final.correctResponse ?? null]}
        >
          <ResultsTable
            head={["Player", "Response", "Ruling", "Wager", "Before", "After"]}
            align={["left", "left", "left", "right", "right", "right"]}
            phoneHidden={[3, 4]}
          >
            {final.rows.map((row) => (
              <Box component="tr" key={row.playerId}>
                <Box component="td" sx={{ ...cellSx, fontWeight: 700 }}>
                  {row.displayName}
                </Box>
                <Box component="td" sx={{ ...cellSx, overflowWrap: "anywhere" }}>
                  {row.answer?.trim() ? `“${row.answer}”` : "(no response)"}
                </Box>
                <Box
                  component="td"
                  sx={{
                    ...cellSx,
                    color:
                      row.verdict === true
                        ? ui.green
                        : row.verdict === false
                          ? ui.negativeInk
                          : ui.inkMuted,
                  }}
                >
                  {row.verdict === true
                    ? "Correct"
                    : row.verdict === false
                      ? "Incorrect"
                      : "No ruling"}
                </Box>
                <Box component="td" sx={numCellSx}>
                  {row.wager !== undefined ? formatMoney(row.wager) : ""}
                </Box>
                <Box component="td" sx={{ ...numCellSx, color: ui.inkMuted }}>
                  {formatMoney(row.scoreBefore)}
                </Box>
                <Box component="td" sx={{ ...numCellSx, fontWeight: 700 }}>
                  {formatMoney(row.scoreAfter)}
                </Box>
              </Box>
            ))}
          </ResultsTable>
        </ResultsSection>
      ) : null}

      <ResultsSection title="How everyone played">
        <ResultsTable
          head={[
            "Player",
            "Accuracy",
            "Correct",
            "Incorrect",
            "First to buzz",
            "Daily Doubles",
            "Avg reaction",
          ]}
          align={["left", "left", "right", "right", "right", "right", "right"]}
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
              <Box
                component="tr"
                key={player.id}
                data-testid={`results-stats-${player.id}`}
              >
                <Box
                  component="th"
                  scope="row"
                  sx={{ ...cellSx, fontWeight: 700, textAlign: "left" }}
                >
                  {player.displayName}
                </Box>
                <Box component="td" sx={{ ...cellSx, minWidth: 140 }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <Box
                      component="span"
                      sx={{ fontVariantNumeric: "tabular-nums", minWidth: "4ch" }}
                    >
                      {accuracy.toFixed(0)}%
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      aria-label={`${player.displayName} accuracy`}
                      value={Math.max(0, Math.min(100, accuracy))}
                      sx={{ flex: 1, height: 4, borderRadius: 2 }}
                    />
                  </Stack>
                </Box>
                <Box component="td" sx={numCellSx}>
                  {correct}
                </Box>
                <Box component="td" sx={numCellSx}>
                  {incorrect}
                </Box>
                <Box component="td" sx={numCellSx}>
                  {firstBuzzes}
                </Box>
                <Box component="td" sx={numCellSx}>
                  {dailyDoubles}
                </Box>
                <Box component="td" sx={numCellSx}>
                  {avgReaction !== null ? `${avgReaction}\u00a0ms` : "None"}
                </Box>
              </Box>
            );
          })}
        </ResultsTable>
      </ResultsSection>

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
  // Strings: in sx a bare 1 means 100%.
  width: "1px",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;

const cellSx = {
  py: 1.5,
  px: 1.5,
  borderBottom: `1px solid ${ui.line}`,
  verticalAlign: "middle",
  fontSize: 16,
  color: ui.ink,
  "&:first-of-type": { pl: 0 },
  "&:last-of-type": { pr: 0 },
} as const;

const numCellSx = {
  ...cellSx,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
} as const;

/** A section of the record: its heading, an optional line of facts, then its table. */
function ResultsSection({
  title,
  "data-testid": testId,
  meta,
  children,
}: {
  title: string;
  "data-testid"?: string;
  meta?: (string | null)[];
  children: ReactNode;
}) {
  const facts = (meta ?? []).filter((fact): fact is string => Boolean(fact));
  return (
    <Box component="section" data-testid={testId} aria-label={title}>
      <Typography component="h2" variant="h4">
        {title}
      </Typography>
      {facts.length > 0 ? (
        <Box
          component="ul"
          sx={{
            listStyle: "none",
            m: 0,
            mt: 1,
            p: 0,
            display: "flex",
            flexWrap: "wrap",
            columnGap: 3,
            rowGap: 0.5,
          }}
        >
          {facts.map((fact) => (
            <Box component="li" key={fact} sx={{ color: ui.inkMuted }}>
              {fact}
            </Box>
          ))}
        </Box>
      ) : null}
      {children}
    </Box>
  );
}

/** A full-width table with hairline rows; it scrolls sideways inside itself on a phone. */
function ResultsTable({
  head,
  align,
  phoneHidden = [],
  children,
}: {
  head: string[];
  align: ("left" | "right")[];
  /** Columns (by index) a phone leaves out, so the ones that matter stay in view. */
  phoneHidden?: number[];
  children: ReactNode;
}) {
  // Each hidden column is dropped from the head and every row with one rule.
  const hideRules = Object.fromEntries(
    phoneHidden.map((index) => [
      `& tr > :nth-of-type(${index + 1})`,
      { display: { xs: "none", sm: "table-cell" } },
    ]),
  );
  return (
    <Box sx={{ mt: 2, overflowX: "auto", maxWidth: "100%", ...hideRules }}>
      <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
        <Box component="thead">
          <Box component="tr">
            {head.map((label, index) => (
              <Box
                component="th"
                scope="col"
                key={`${label}-${index}`}
                sx={{
                  ...cellSx,
                  py: 1,
                  fontSize: 14,
                  fontWeight: 600,
                  color: ui.inkMuted,
                  whiteSpace: "nowrap",
                  textAlign: align[index] ?? "left",
                }}
              >
                {label ? (
                  label
                ) : (
                  <Box component="span" sx={visuallyHidden}>
                    Rank
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">{children}</Box>
      </Box>
    </Box>
  );
}
