"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import EmojiEventsIcon from "@mui/icons-material/EmojiEventsOutlined";
import type { PublicGameState } from "@/lib/game";
import { computeResults, joinNames, ordinal, type Standing } from "@/lib/game/results";
import { formatMoney } from "@/lib/foundation/money";
import {
  boardGradient,
  clueType,
  displayType,
  jeopardyPalette,
} from "@/lib/foundation/jeopardy-style";
import { lastFinalReveal } from "./use-final-reveal";

interface TvResultsProps {
  state: PublicGameState;
  reducedMotion: boolean;
}

/**
 * The end of the game, on the television.
 *
 * The climax the whole room is watching: the winner (or winners) large, a
 * podium of the top three, the full standings, and — when this screen saw
 * Final Jeopardy — what each contestant wrote and wagered. Contestants only:
 * a television is never a player.
 */
export function TvResults({ state, reducedMotion }: TvResultsProps) {
  const { standings, winners, tie } = computeResults(state.players);
  const final = lastFinalReveal(state);
  const podium = standings.slice(0, 3);
  // Silver, gold, bronze — the winner in the middle, the way a podium stands.
  const podiumOrder = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;
  const rise = reducedMotion
    ? {}
    : {
        "@media (prefers-reduced-motion: no-preference)": {
          animation: "tv-rise 520ms ease-out both",
        },
        "@keyframes tv-rise": {
          from: { opacity: 0, transform: "translateY(4vh)" },
          to: { opacity: 1, transform: "none" },
        },
      };

  return (
    <Box
      data-testid="tv-results"
      component="section"
      aria-labelledby="tv-results-heading"
      sx={{
        width: "100%",
        height: "var(--board-fill-height, 100dvh)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2.4vh",
        background: boardGradient,
        borderRadius: 1,
        px: "4vw",
        py: "3vh",
        overflow: "hidden",
        textAlign: "center",
      }}
    >
      <EmojiEventsIcon
        aria-hidden
        sx={{ fontSize: "clamp(40px, 9vh, 120px)", color: jeopardyPalette.goldBright }}
      />
      <Typography
        id="tv-results-heading"
        component="h1"
        data-testid="tv-results-winner"
        sx={displayType({
          fontWeight: 700,
          fontSize: "clamp(28px, 8vh, 110px)",
          lineHeight: 1,
          color: "#fff",
          textShadow: "0.05em 0.05em 0 rgba(0,0,0,0.8)",
          overflowWrap: "anywhere",
          ...rise,
        })}
      >
        {winners.length === 0
          ? "Game over"
          : tie
            ? `Tie: ${joinNames(winners.map((winner) => winner.displayName))}`
            : `${winners[0].displayName} wins`}
      </Typography>
      {winners.length > 0 ? (
        <Typography
          sx={displayType({
            fontWeight: 700,
            fontSize: "clamp(22px, 6vh, 80px)",
            color: jeopardyPalette.goldBright,
            lineHeight: 1,
          })}
        >
          {formatMoney(winners[0].score)}
        </Typography>
      ) : null}

      {podium.length > 0 ? (
        <Box
          data-testid="tv-podium"
          role="list"
          aria-label="Podium"
          sx={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "2vw" }}
        >
          {podiumOrder.map((entry) => (
            <PodiumStep key={entry.player.id} entry={entry} />
          ))}
        </Box>
      ) : null}

      {standings.length > 3 ? (
        <Box
          component="ol"
          aria-label="Other standings"
          sx={{
            listStyle: "none",
            m: 0,
            p: 0,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "1vh 3vw",
          }}
        >
          {standings.slice(3).map((entry) => (
            <Box
              component="li"
              key={entry.player.id}
              sx={displayType({ fontSize: "clamp(14px, 2.6vh, 34px)", color: "rgba(255,255,255,0.85)" })}
            >
              {ordinal(entry.rank)} · {entry.player.displayName} · {formatMoney(entry.player.score)}
            </Box>
          ))}
        </Box>
      ) : null}

      {final && final.rows.length > 0 ? (
        <Box data-testid="tv-results-final" sx={{ width: "100%", maxWidth: 1400 }}>
          <Typography
            component="h2"
            sx={displayType({
              fontSize: "clamp(12px, 2.2vh, 28px)",
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.82)",
              mb: "1vh",
            })}
          >
            Final Jeopardy · {final.correctResponse ?? final.category}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(final.rows.length, 4)}, minmax(0, 1fr))`,
              gap: "1.2vw",
            }}
          >
            {final.rows.map((row) => (
              <Box
                key={row.playerId}
                sx={{
                  border: `2px solid ${
                    row.verdict === true
                      ? jeopardyPalette.correct
                      : row.verdict === false
                        ? jeopardyPalette.incorrect
                        : "rgba(255,255,255,0.25)"
                  }`,
                  borderRadius: 1,
                  p: "1vh",
                  background: "rgba(0,0,0,0.25)",
                  minWidth: 0,
                }}
              >
                <Typography sx={displayType({ fontSize: "clamp(12px, 2.2vh, 28px)", color: "#fff" })}>
                  {row.displayName}
                </Typography>
                <Typography
                  sx={clueType({ fontSize: "clamp(12px, 2.4vh, 30px)", overflowWrap: "anywhere" })}
                >
                  {row.answer?.trim() ? row.answer : "(no response)"}
                </Typography>
                <Typography
                  sx={displayType({
                    fontSize: "clamp(11px, 1.9vh, 24px)",
                    color: "rgba(255,255,255,0.85)",
                    fontVariantNumeric: "tabular-nums",
                  })}
                >
                  {row.wager !== undefined ? `Wagered ${formatMoney(row.wager)} · ` : ""}
                  {formatMoney(row.scoreBefore)} → {formatMoney(row.scoreAfter)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}

function PodiumStep({ entry }: { entry: Standing }) {
  const height = entry.rank === 1 ? "16vh" : entry.rank === 2 ? "11vh" : "7vh";
  return (
    <Box
      role="listitem"
      data-testid={`tv-podium-${entry.player.id}`}
      aria-label={`${ordinal(entry.rank)}${entry.tied ? " (tied)" : ""}: ${entry.player.displayName}, ${formatMoney(entry.player.score)}`}
      sx={{ display: "flex", flexDirection: "column", alignItems: "center", width: "clamp(120px, 18vw, 320px)" }}
    >
      <Typography
        sx={displayType({
          fontSize: "clamp(16px, 3.4vh, 44px)",
          color: "#fff",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        })}
      >
        {entry.player.displayName}
      </Typography>
      <Typography
        sx={displayType({
          fontSize: "clamp(16px, 3.4vh, 44px)",
          fontWeight: 700,
          color: entry.player.score < 0 ? "#FFB4B4" : jeopardyPalette.goldBright,
          fontVariantNumeric: "tabular-nums",
        })}
      >
        {formatMoney(entry.player.score)}
      </Typography>
      <Box
        aria-hidden
        sx={{
          mt: "0.6vh",
          width: "100%",
          height,
          background: entry.winner ? jeopardyPalette.goldBright : "rgba(0,0,0,0.35)",
          color: entry.winner ? "#1A1200" : "#fff",
          borderRadius: "6px 6px 0 0",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          pt: "0.8vh",
          ...displayType({ fontSize: "clamp(18px, 4vh, 56px)", fontWeight: 700 }),
        }}
      >
        {entry.rank}
      </Box>
    </Box>
  );
}
