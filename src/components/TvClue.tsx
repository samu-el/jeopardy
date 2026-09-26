"use client";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import type { PublicGameState } from "@/lib/game";
import { getFinalReveal, type FinalReveal, type FinalRevealRow } from "@/lib/game/final-reveal";
import type { ClientGameCommand } from "@/lib/realtime/contracts";
import { useGameStore } from "@/lib/state/game-store";
import { formatMoney } from "@/lib/foundation/money";
import {
  boardGradient,
  clueScale,
  clueType,
  displayType,
  jeopardyPalette,
} from "@/lib/foundation/jeopardy-style";
import { DailyDoubleSplash } from "./DailyDoubleSplash";
import { useCountdown, useDailyDoubleSplash, useFinalTheme } from "./clue/use-clue-moments";

interface TvClueProps {
  state: PublicGameState;
  canControl: boolean;
  onCommand: (command: ClientGameCommand) => void;
}

/** Read from a sofa: the header sits well above caption size on a TV. */
const headerSize = "clamp(16px, 2.3cqw, 38px)";
const headerInk = "rgba(255,255,255,0.82)";

/**
 * The clue, filling a television.
 *
 * The whole panel is one button: click to reveal the answer, click again to
 * go back to the board. Type is sized against the board rather than the
 * viewport, so the same clue reads the same on a laptop and across a room.
 *
 * Final Jeopardy is its own layout: the category while the room wagers, the
 * clue with a clock while it writes, then each contestant's response, wager
 * and new score, lowest score first.
 */
export function TvClue({ state, canControl, onCommand }: TvClueProps) {
  const preferences = useGameStore((s) => s.preferences);
  // The television is the screen with the speakers: the sting and the think
  // music play here, not only on the laptop's clue panel.
  const splashVisible = useDailyDoubleSplash(state, preferences.soundEnabled);
  useFinalTheme(state, preferences.soundEnabled);

  const clue = state.currentClue;
  if (!clue) return null;

  const final = getFinalReveal(state);
  const splash = (
    <DailyDoubleSplash visible={splashVisible} reducedMotion={preferences.reducedMotion} />
  );

  if (final) {
    // Nothing to click while the room is wagering, writing or being judged:
    // the clocks and the judge move Final along. Once every ruling is in,
    // a click takes the room to the results.
    const clickable = canControl && final.phase === "done";
    return (
      <>
        <ButtonBase
          data-testid="tv-clue"
          data-phase={final.phase}
          disabled={!clickable}
          aria-label={clickable ? "Show the results" : "Final Jeopardy"}
          onClick={() => clickable && onCommand({ type: "skip" })}
          sx={panelSx(clickable)}
        >
          <TvFinal final={final} />
        </ButtonBase>
        {splash}
      </>
    );
  }

  // No clue text yet means the room is still collecting a Daily Double wager.
  // Nothing to advance to, so the screen waits rather than offering a click
  // the server would only reject.
  const waiting = clue.clue === undefined;
  const answered = clue.correctResponse !== undefined;
  const clickable = canControl && !waiting;
  const wagerer = clue.dailyDoublePlayerId
    ? state.players.find((player) => player.id === clue.dailyDoublePlayerId)?.displayName
    : undefined;

  return (
    <>
      <ButtonBase
        data-testid="tv-clue"
        disabled={!clickable}
        aria-label={answered ? "Back to the board" : "Reveal the answer"}
        onClick={() =>
          clickable && onCommand(answered ? { type: "skip" } : { type: "reveal-answer" })
        }
        sx={panelSx(clickable)}
      >
        <Typography
          component="span"
          data-testid="tv-clue-header"
          sx={displayType({ letterSpacing: "0.12em", color: headerInk, fontSize: headerSize })}
        >
          {clue.dailyDouble
            ? `${clue.category} · Daily Double`
            : `${clue.category} · ${formatMoney(clue.value)}`}
        </Typography>

        {waiting ? (
          <Typography
            component="span"
            data-testid="tv-waiting"
            sx={displayType({
              letterSpacing: "0.1em",
              color: jeopardyPalette.goldBright,
              fontSize: "clamp(18px, 3.4cqw, 56px)",
            })}
          >
            {wagerer ? `Daily Double — ${wagerer} is wagering` : "Daily Double — wagering"}
          </Typography>
        ) : (
          <Typography
            component="span"
            data-testid="tv-clue-text"
            sx={clueType({
              // Once the answer is up the question steps back to a caption —
              // the answer is what the room is looking at now — but stays
              // readable across a room.
              fontSize: answered ? "clamp(14px, 2.4cqw, 40px)" : clueScale(clue.clue?.length ?? 0).tv,
              lineHeight: 1.2,
              letterSpacing: "0.005em",
              color: answered ? "rgba(255,255,255,0.8)" : jeopardyPalette.clueText,
            })}
          >
            {clue.clue}
          </Typography>
        )}

        {answered ? (
          <Typography
            component="span"
            data-testid="tv-answer"
            sx={clueType({
              fontWeight: 700,
              fontSize: "clamp(24px, 5.4cqw, 92px)",
              lineHeight: 1.15,
              color: jeopardyPalette.goldBright,
            })}
          >
            {clue.correctResponse}
          </Typography>
        ) : null}
      </ButtonBase>
      {splash}
    </>
  );
}

function panelSx(clickable: boolean) {
  return {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2cqw",
    px: "6cqw",
    py: "3cqw",
    textAlign: "center",
    cursor: clickable ? "pointer" : "default",
    background: boardGradient,
    // A disabled ButtonBase dims nothing, but make sure it never greys out
    // the text the room is reading.
    "&.Mui-disabled": { color: "inherit" },
  } as const;
}

function TvFinal({ final }: { final: FinalReveal }) {
  const seconds = useCountdown(final.deadline);
  const revealing = final.phase === "revealing" || final.phase === "done";

  return (
    <>
      <Typography
        component="span"
        data-testid="tv-final-headline"
        sx={displayType({
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: jeopardyPalette.goldBright,
          whiteSpace: "nowrap",
          fontSize: revealing ? "clamp(18px, 3cqw, 52px)" : "clamp(24px, 5cqw, 88px)",
          textShadow: "0.06em 0.06em 0 rgba(0,0,0,0.85)",
        })}
      >
        Final Jeopardy!
      </Typography>

      <Typography
        component="span"
        data-testid="tv-clue-header"
        sx={displayType({
          letterSpacing: "0.1em",
          color: final.phase === "wagering" ? "#fff" : headerInk,
          fontSize: final.phase === "wagering" ? "clamp(22px, 4.4cqw, 76px)" : headerSize,
        })}
      >
        {final.category}
      </Typography>

      {final.phase === "wagering" ? (
        <Typography
          component="span"
          data-testid="tv-waiting"
          sx={displayType({
            letterSpacing: "0.08em",
            color: headerInk,
            fontSize: "clamp(14px, 2.2cqw, 36px)",
          })}
        >
          {final.waitingFor.length > 0
            ? `Contestants are wagering · waiting on ${final.waitingFor.join(", ")}`
            : "Contestants are wagering"}
        </Typography>
      ) : null}

      {final.clue && final.phase !== "wagering" ? (
        <Typography
          component="span"
          data-testid="tv-clue-text"
          sx={clueType({
            fontSize: revealing ? "clamp(14px, 2.2cqw, 36px)" : clueScale(final.clue.length).tv,
            lineHeight: 1.2,
            color: revealing ? "rgba(255,255,255,0.8)" : jeopardyPalette.clueText,
          })}
        >
          {final.clue}
        </Typography>
      ) : null}

      {seconds !== null && !revealing ? (
        <Typography
          component="span"
          role="timer"
          aria-label={`${seconds} seconds left`}
          data-testid="tv-final-countdown"
          sx={displayType({
            fontVariantNumeric: "tabular-nums",
            color: seconds <= 5 ? jeopardyPalette.goldBright : "#fff",
            fontSize: "clamp(18px, 3cqw, 52px)",
          })}
        >
          0:{String(seconds).padStart(2, "0")}
        </Typography>
      ) : null}

      {revealing && final.correctResponse ? (
        <Typography
          component="span"
          data-testid="tv-answer"
          sx={clueType({
            fontWeight: 700,
            fontSize: "clamp(22px, 4.4cqw, 80px)",
            lineHeight: 1.15,
            color: jeopardyPalette.goldBright,
          })}
        >
          {final.correctResponse}
        </Typography>
      ) : null}

      {revealing && final.rows.length > 0 ? (
        <Box
          data-testid="tv-final-reveal"
          sx={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(final.rows.length, 4)}, minmax(0, 1fr))`,
            gap: "1.4cqw",
            width: "100%",
          }}
        >
          {final.rows.map((row) => (
            <RevealCard key={row.playerId} row={row} />
          ))}
        </Box>
      ) : null}
    </>
  );
}

/**
 * One contestant's Final: hidden until their turn, then the response, and
 * the wager and new score once the ruling is in.
 */
function RevealCard({ row }: { row: FinalRevealRow }) {
  const ruled = row.verdict !== undefined;
  const shown = ruled || row.current;
  const verdictText =
    row.verdict === true ? "Correct" : row.verdict === false ? "Incorrect" : ruled ? "No ruling" : "";
  const edge =
    row.verdict === true
      ? jeopardyPalette.correct
      : row.verdict === false
        ? jeopardyPalette.incorrect
        : row.current
          ? jeopardyPalette.goldBright
          : "rgba(255,255,255,0.2)";

  return (
    <Box
      data-testid={`tv-final-row-${row.playerId}`}
      data-verdict={ruled ? String(row.verdict) : "pending"}
      sx={{
        border: `0.25cqw solid ${edge}`,
        borderRadius: "0.8cqw",
        p: "1cqw",
        background: "rgba(0,0,0,0.25)",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: "0.4cqw",
      }}
    >
      <Typography
        component="span"
        sx={displayType({ fontSize: "clamp(12px, 1.8cqw, 30px)", color: "#fff" })}
      >
        {row.displayName}
      </Typography>
      <Typography
        component="span"
        data-testid={`tv-final-answer-${row.playerId}`}
        sx={clueType({
          fontSize: "clamp(12px, 1.9cqw, 32px)",
          color: shown ? jeopardyPalette.clueText : "rgba(255,255,255,0.5)",
          overflowWrap: "anywhere",
        })}
      >
        {shown ? (row.answer?.trim() ? row.answer : "(no response)") : "…"}
      </Typography>
      {ruled ? (
        <Typography
          component="span"
          data-testid={`tv-final-score-${row.playerId}`}
          sx={displayType({
            fontSize: "clamp(11px, 1.5cqw, 26px)",
            color: row.verdict === false ? "#FFB4B4" : row.verdict ? "#B8F5C4" : headerInk,
            fontVariantNumeric: "tabular-nums",
          })}
        >
          {verdictText}
          {row.wager !== undefined ? ` · wagered ${formatMoney(row.wager)}` : ""}
          {` · ${formatMoney(row.scoreBefore)} → ${formatMoney(row.scoreAfter)}`}
        </Typography>
      ) : row.current ? (
        <Typography
          component="span"
          sx={displayType({ fontSize: "clamp(11px, 1.5cqw, 26px)", color: headerInk })}
        >
          Judging…
        </Typography>
      ) : null}
    </Box>
  );
}
