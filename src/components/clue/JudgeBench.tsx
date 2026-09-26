"use client";

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CheckIcon from "@mui/icons-material/CheckCircleOutlined";
import CloseIcon from "@mui/icons-material/HighlightOff";
import UndoIcon from "@mui/icons-material/UndoOutlined";
import WarningIcon from "@mui/icons-material/WarningAmberOutlined";
import type { PublicGameState } from "@/lib/game";
import { lastRuling, nameOf } from "@/lib/game/clue-turn";
import type { ClientGameCommand } from "@/lib/realtime";
import { judgeAnswer as fuzzyJudge } from "@/lib/ai";
import { controls, jeopardyFonts, jeopardyPalette, ui } from "@/lib/foundation/jeopardy-style";
import { Housing, HousingDivider } from "../Housing";
import { benchKeySx, wrapHousingSx } from "./bench-style";

/** White text on this red is 5.9:1; the palette's brighter red is 3.2:1. */
const incorrectFill = "#C8102E";
/** Dark text on the palette green: 9:1. */
const correctInk = "#03220F";

/**
 * The fuzzy matcher's opinion, in words. Its number is string similarity,
 * not certainty, so it is printed as a match score beside a verdict — and
 * anything near the line is flagged for the host to look at.
 */
export function describeSuggestion(answer: string, expected: string) {
  if (!answer.trim()) return { verdict: "No answer", correct: false, nearMiss: false, match: null };
  const result = fuzzyJudge({ submittedAnswer: answer, expectedAnswer: expected });
  const match = Math.round(result.confidence * 100);
  const nearMiss = result.confidence >= 0.6 && result.confidence < 0.9;
  return {
    verdict: result.correct ? "Looks right" : "Looks wrong",
    correct: result.correct,
    nearMiss,
    match,
  };
}

interface JudgeBenchProps {
  state: PublicGameState;
  send: (command: ClientGameCommand) => void;
}

/**
 * The host's bench.
 *
 * While an answer waits: who said what, the AI's suggestion, and Correct /
 * Incorrect / Skip. Once it has been ruled on — by the host or by the AI
 * judge — the bench stays up with the ruling and the keys to reverse it or
 * undo it, for as long as the clue is on screen.
 */
export function JudgeBench({ state, send }: JudgeBenchProps) {
  const clue = state.currentClue;
  if (!clue) return null;
  const pending = clue.correctResponse !== undefined ? clue.currentJudgePlayerId : undefined;
  const ruling = lastRuling(clue);

  if (pending) {
    const answer = clue.answers[pending] ?? "";
    const suggestion = describeSuggestion(answer, clue.correctResponse ?? "");
    const wager = clue.wagers[pending];
    return (
      <Box role="group" aria-label={`Judge ${nameOf(state, pending)}`} data-testid="judge-bench" sx={{ maxWidth: "100%" }}>
      <Housing sx={wrapHousingSx}>
        <Readout
          name={nameOf(state, pending)}
          answer={answer}
          wager={wager}
          note={
            <Suggestion
              verdict={suggestion.verdict}
              correct={suggestion.correct}
              nearMiss={suggestion.nearMiss}
              match={suggestion.match}
            />
          }
        />
        <HousingDivider sx={{ display: { xs: "none", sm: "block" } }} />
        <VerdictKeys
          onJudge={(correct) => send({ type: "judge-answer", targetPlayerId: pending, correct })}
        />
      </Housing>
      </Box>
    );
  }

  if (!ruling || ruling.correct === null) return null;

  // Reverse a ruling: put the clue back to before it, and rule again.
  // Whether the room's snapshot sits before the reveal or before the ruling,
  // the reveal is then either needed or harmlessly refused.
  function overrule(correct: boolean) {
    if (!ruling) return;
    send({ type: "undo" });
    send({ type: "reveal-answer" });
    send({ type: "judge-answer", targetPlayerId: ruling.playerId, correct });
  }

  const name = nameOf(state, ruling.playerId);
  return (
    <Box role="group" aria-label={`Ruling on ${name}`} data-testid="judge-override" sx={{ maxWidth: "100%" }}>
    <Housing sx={wrapHousingSx}>
      <Readout
        name={name}
        answer={clue.answers[ruling.playerId]}
        note={
          <Box
            component="span"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              fontFamily: jeopardyFonts.display,
              fontSize: 11,
              letterSpacing: "0.08em",
              color: ruling.correct ? jeopardyPalette.correct : "#FF8A93",
            }}
          >
            {ruling.correct ? <CheckIcon sx={{ fontSize: 14 }} /> : <CloseIcon sx={{ fontSize: 14 }} />}
            RULED {ruling.correct ? "CORRECT" : "INCORRECT"}
          </Box>
        }
      />
      <HousingDivider sx={{ display: { xs: "none", sm: "block" } }} />
      <Button
        size="small"
        variant="contained"
        onClick={() => overrule(!ruling.correct)}
        data-testid="overrule"
        sx={{
          ...benchKeySx,
          ...(ruling.correct
            ? { background: incorrectFill, color: "#fff", "&:hover": { background: "#A50D26" } }
            : { background: jeopardyPalette.correct, color: correctInk, "&:hover": { background: "#27B86B" } }),
        }}
      >
        Mark {ruling.correct ? "incorrect" : "correct"}
      </Button>
      <Button
        size="small"
        variant="outlined"
        startIcon={<UndoIcon />}
        onClick={() => send({ type: "undo" })}
        data-testid="undo-ruling"
        sx={benchKeySx}
      >
        Undo
      </Button>
    </Housing>
    </Box>
  );
}

function Readout({
  name,
  answer,
  wager,
  note,
}: {
  name: string;
  answer?: string;
  wager?: number;
  note?: ReactNode;
}) {
  return (
    // On a phone the readout takes a row of its own and the keys sit
    // centred under it: two balanced rows, not a ragged wrap.
    <Box
      sx={{
        ...controls.readout,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        columnGap: 1,
        minHeight: 32,
        px: 1.5,
        mr: { xs: 0, sm: 0.5 },
        flexBasis: { xs: "100%", sm: "auto" },
        fontSize: 14,
        color: ui.ink,
      }}
    >
      <Box component="span" sx={{ color: ui.inkMuted }}>
        {name}
      </Box>
      <Box component="span" sx={{ color: jeopardyPalette.goldBright, fontWeight: 700 }}>
        {answer || "—"}
      </Box>
      {note}
      {wager !== undefined ? (
        <Box component="span" sx={{ fontSize: 12, color: jeopardyPalette.gold }}>
          wagered ${wager}
        </Box>
      ) : null}
    </Box>
  );
}

function Suggestion({
  verdict,
  correct,
  nearMiss,
  match,
}: {
  verdict: string;
  correct: boolean;
  nearMiss: boolean;
  match: number | null;
}) {
  // Neutral ink: the words carry the verdict, so the colour doesn't have to
  // — and can't contradict it.
  return (
    <Box
      component="span"
      data-testid="ai-suggestion"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        fontSize: 12,
        color: ui.inkMuted,
      }}
    >
      {nearMiss ? (
        <WarningIcon sx={{ fontSize: 14, color: jeopardyPalette.gold }} aria-hidden />
      ) : correct ? (
        <CheckIcon sx={{ fontSize: 14 }} aria-hidden />
      ) : (
        <CloseIcon sx={{ fontSize: 14 }} aria-hidden />
      )}
      AI: {verdict}
      {match !== null ? ` · ${match}% match` : ""}
      {nearMiss ? (
        <Box component="span" sx={{ color: jeopardyPalette.gold, fontWeight: 700 }}>
          · close, check it
        </Box>
      ) : null}
    </Box>
  );
}

function VerdictKeys({ onJudge }: { onJudge: (correct: boolean | null) => void }) {
  return (
    <>
      <Button
        size="small"
        variant="contained"
        startIcon={<CheckIcon />}
        onClick={() => onJudge(true)}
        sx={{
          ...benchKeySx,
          background: jeopardyPalette.correct,
          color: correctInk,
          "&:hover": { background: "#27B86B" },
        }}
      >
        Correct
      </Button>
      <Button
        size="small"
        variant="contained"
        startIcon={<CloseIcon />}
        onClick={() => onJudge(false)}
        sx={{
          ...benchKeySx,
          background: incorrectFill,
          color: "#fff",
          "&:hover": { background: "#A50D26" },
        }}
      >
        Incorrect
      </Button>
      <Button size="small" variant="outlined" onClick={() => onJudge(null)} sx={benchKeySx}>
        Skip
      </Button>
    </>
  );
}
