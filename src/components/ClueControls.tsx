"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { PublicGameState } from "@/lib/game";
import { useGameStore } from "@/lib/state/game-store";
import { judgeAnswer as fuzzyJudge, primeAudio, primeSpeech } from "@/lib/ai";
import { jeopardyFonts, jeopardyPalette } from "@/lib/foundation/jeopardy-style";
import { MicAnswerField } from "./MicAnswerField";
import { BuzzLights } from "./BuzzLights";
import { useClueTurn } from "./use-clue-turn";

interface ClueControlsProps {
  state: PublicGameState;
  currentClientId: string;
}

/**
 * The clock and the things you type: the countdown, the answer, the wager,
 * and the host's judging.
 *
 * The buttons live on your lectern (`PodiumClueButtons`) — a thumb goes to
 * the same place every clue. What is left here is what a lectern has no room
 * for: a progress bar, a text field, and a row about somebody else's answer.
 * None of it is on the board any more; the board carries the clue.
 */
export function ClueControls({ state, currentClientId }: ClueControlsProps) {
  const reducedMotion = useGameStore((s) => s.preferences.reducedMotion);
  const [answerInput, setAnswerInput] = useState("");
  const [wagerInput, setWagerInput] = useState("");
  const turn = useClueTurn(state, currentClientId);
  const { clue, send } = turn;

  // A new clue clears whatever was half-typed for the last one.
  const activeClueId = clue?.clueId ?? null;
  const [trackedClueId, setTrackedClueId] = useState<string | null>(null);
  if (trackedClueId !== activeClueId) {
    setTrackedClueId(activeClueId);
    setAnswerInput("");
    setWagerInput("");
  }

  const { iAmHost, clueRevealed, answerRevealed, canAdvance } = turn;
  const judgeTarget = clue?.currentJudgePlayerId;

  // The shortcuts are registered here rather than in the hook, because the
  // hook runs in two components and a keystroke would fire twice.
  useEffect(() => {
    if (!clue) return;
    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const inField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (event.code === "Space" && !inField && !answerRevealed) {
        event.preventDefault();
        send({ type: "buzz" });
        return;
      }
      if (inField) return;
      if (event.key.toLowerCase() === "r" && !answerRevealed && clueRevealed && iAmHost) {
        event.preventDefault();
        send({ type: "reveal-answer" });
        return;
      }
      if (iAmHost && answerRevealed && judgeTarget) {
        if (event.key.toLowerCase() === "y") {
          event.preventDefault();
          send({ type: "judge-answer", targetPlayerId: judgeTarget, correct: true });
          return;
        }
        if (event.key.toLowerCase() === "n") {
          event.preventDefault();
          send({ type: "judge-answer", targetPlayerId: judgeTarget, correct: false });
          return;
        }
      }
      if (event.key.toLowerCase() === "s" && canAdvance && iAmHost) {
        event.preventDefault();
        send({ type: "skip" });
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [clue, send, iAmHost, canAdvance, judgeTarget, answerRevealed, clueRevealed]);

  if (!clue) return null;

  function handleSubmitAnswer(dictated?: string) {
    const text = (dictated ?? answerInput).trim();
    if (!text) return;
    send({ type: "submit-answer", answer: text });
    setAnswerInput("");
  }

  function handleSubmitWager() {
    const amount = Math.round(Number(wagerInput));
    if (!Number.isFinite(amount)) return;
    send({ type: "submit-wager", amount });
  }

  const { isFinal, iSubmitted, buzzedByMe, myWagerOpen, wagerSubmittedByMe } = turn;
  const wagerOpen = myWagerOpen && !wagerSubmittedByMe;
  const answerOpen =
    !isFinal &&
    clueRevealed &&
    !answerRevealed &&
    (buzzedByMe || clue.dailyDouble) &&
    !iSubmitted;
  const finalOpen = isFinal && clueRevealed && !answerRevealed && !iSubmitted;
  const typing = answerOpen || finalOpen;

  return (
    <Box
      data-testid="clue-controls"
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.75,
        py: 0.5,
      }}
    >
      {!answerRevealed ? (
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "center", justifyContent: "center", width: "100%" }}
        >
          <BuzzLights
            remaining={turn.lightsRemaining}
            reducedMotion={reducedMotion}
            label={turn.lightsLabel}
          />
          {/* Your answer goes on the clock's own line. Under it, the strip
              grew tall enough to push a lectern off a laptop screen — and
              while you are typing, the lights say what the countdown would. */}
          {typing ? (
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flex: 1, maxWidth: 380 }}
            >
              <MicAnswerField
                label={finalOpen ? "Final answer" : "What is…"}
                value={answerInput}
                onChange={setAnswerInput}
                onSubmit={handleSubmitAnswer}
                disabled={iSubmitted}
                size="small"
                autoFocus
              />
              <Button
                variant="contained"
                size="small"
                onClick={() => handleSubmitAnswer()}
                disabled={!answerInput.trim() || iSubmitted}
              >
                {finalOpen ? "Lock in" : "Send"}
              </Button>
            </Stack>
          ) : (
            <Typography
              sx={{
                fontFamily: jeopardyFonts.display,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                fontSize: { xs: 10, sm: 12 },
                color: "rgba(255,255,255,0.6)",
                whiteSpace: "nowrap",
              }}
            >
              {turn.countdown}
            </Typography>
          )}
        </Stack>
      ) : null}

      {wagerOpen ? (
        <Stack spacing={1} sx={{ alignItems: "center" }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <TextField
              label="Wager"
              type="number"
              value={wagerInput}
              onChange={(event) => setWagerInput(event.target.value)}
              helperText={`$${turn.wagerLimits.min} – $${turn.wagerLimits.max}`}
              slotProps={{
                htmlInput: { min: turn.wagerLimits.min, max: turn.wagerLimits.max },
              }}
              size="small"
              autoFocus
              sx={wagerFieldSx}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSubmitWager();
                }
              }}
            />
            <Button variant="contained" onClick={handleSubmitWager} sx={{ mt: 0.25 }}>
              Wager
            </Button>
          </Stack>
          <Stack direction="row" spacing={1}>
            {!isFinal ? (
              <Button
                size="small"
                sx={quietButtonSx}
                onClick={() => setWagerInput(String(clue.value))}
              >
                ${clue.value}
              </Button>
            ) : null}
            <Button
              size="small"
              sx={quietButtonSx}
              onClick={() => setWagerInput(String(turn.wagerLimits.max))}
            >
              {isFinal ? "Everything" : "True Daily Double"}
            </Button>
          </Stack>
        </Stack>
      ) : null}

      {iSubmitted && !answerRevealed ? (
        <Typography sx={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
          Answer locked in
        </Typography>
      ) : null}

      {iAmHost && answerRevealed && clue.currentJudgePlayerId ? (
        <JudgePanel
          state={state}
          target={clue.currentJudgePlayerId}
          answer={clue.answers[clue.currentJudgePlayerId] ?? ""}
          expected={clue.correctResponse ?? ""}
          wager={clue.wagers[clue.currentJudgePlayerId]}
          onJudge={(correct) => {
            if (!clue.currentJudgePlayerId) return;
            send({
              type: "judge-answer",
              targetPlayerId: clue.currentJudgePlayerId,
              correct,
            });
          }}
        />
      ) : null}
    </Box>
  );
}

/**
 * The buttons, on your own lectern.
 *
 * Stacked and one width, so BUZZ and Reveal read as a pair rather than two
 * shapes that happen to be next to each other, and so the thing you press
 * every clue is always in the same place — under your own score, not
 * floating in the middle of the screen.
 */
export function PodiumClueButtons({ state, currentClientId }: ClueControlsProps) {
  const turn = useClueTurn(state, currentClientId);
  const buzzerRef = useRef<HTMLButtonElement | null>(null);
  const { clue, send } = turn;

  useEffect(() => {
    if (clue?.canBuzz && clue.buzzes[currentClientId] === undefined) {
      buzzerRef.current?.focus();
    }
  }, [clue?.canBuzz, clue?.buzzes, currentClientId]);

  if (!clue) return null;

  const { iAmHost, isFinal, clueRevealed, answerRevealed, canIBuzz } = turn;
  const showBuzzer = !isFinal && clueRevealed && !answerRevealed && !clue.dailyDouble;
  const showReveal = iAmHost && clueRevealed && !answerRevealed;
  const showNext = iAmHost && turn.canAdvance;
  if (!showBuzzer && !showReveal && !showNext) return null;

  return (
    <Stack spacing={0.5} sx={{ mt: 0.75 }}>
      {showBuzzer ? (
        <Button
          ref={buzzerRef}
          onClick={() => {
            primeAudio();
            primeSpeech();
            send({ type: "buzz" });
          }}
          disabled={!canIBuzz}
          variant="contained"
          data-testid="buzzer"
          aria-label="Buzz in"
          sx={{
            ...stackedButtonSx,
            fontFamily: jeopardyFonts.display,
            fontSize: 15,
            letterSpacing: "0.12em",
            background: canIBuzz
              ? "linear-gradient(180deg, #ff5f6d 0%, #c31432 100%)"
              : "rgba(255,255,255,0.10)",
            color: canIBuzz ? "#fff" : "rgba(255,255,255,0.45)",
            boxShadow: canIBuzz ? "0 0 18px rgba(255,80,90,0.5)" : "none",
            "&.Mui-disabled": {
              background: "rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.45)",
            },
          }}
        >
          {turn.buzzedByMe ? "IN!" : turn.isLockedOut ? "LOCKED" : "BUZZ"}
        </Button>
      ) : null}

      {showReveal ? (
        <Button
          variant="outlined"
          onClick={() => send({ type: "reveal-answer" })}
          sx={{ ...stackedButtonSx, ...quietButtonSx }}
        >
          Reveal
        </Button>
      ) : null}

      {showNext ? (
        <Button
          variant="contained"
          data-testid="next-clue"
          onClick={() => send({ type: "skip" })}
          sx={stackedButtonSx}
        >
          Next clue
        </Button>
      ) : null}
    </Stack>
  );
}

function JudgePanel({
  state,
  target,
  answer,
  expected,
  wager,
  onJudge,
}: {
  state: PublicGameState;
  target: string;
  answer: string;
  expected: string;
  wager?: number;
  onJudge: (correct: boolean | null) => void;
}) {
  const verdict = fuzzyJudge({ submittedAnswer: answer, expectedAnswer: expected });
  const name = state.players.find((player) => player.id === target)?.displayName ?? target;
  return (
    <Box sx={{ textAlign: "center" }}>
      <Typography sx={{ color: "rgba(255,255,255,0.85)", mb: 1, fontSize: 15 }}>
        {name}:{" "}
        <Box component="span" sx={{ color: jeopardyPalette.goldBright, fontWeight: 700 }}>
          {answer || "—"}
        </Box>{" "}
        <Box
          component="span"
          sx={{
            fontSize: 12,
            color: verdict.correct ? jeopardyPalette.correct : jeopardyPalette.incorrect,
          }}
        >
          {Math.round(verdict.confidence * 100)}%
        </Box>
        {wager !== undefined ? (
          <Box component="span" sx={{ fontSize: 13, color: jeopardyPalette.gold, ml: 1 }}>
            wagered ${wager}
          </Box>
        ) : null}
      </Typography>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ flexWrap: "wrap", justifyContent: "center" }}
      >
        <Button variant="contained" color="success" onClick={() => onJudge(true)}>
          Correct
        </Button>
        <Button variant="contained" color="error" onClick={() => onJudge(false)}>
          Incorrect
        </Button>
        <Button variant="outlined" sx={quietButtonSx} onClick={() => onJudge(null)}>
          Skip
        </Button>
      </Stack>
    </Box>
  );
}

/** One width, one height: a stack of these reads as a set. */
const stackedButtonSx = {
  width: "100%",
  minWidth: 0,
  py: 0.6,
  borderRadius: 1,
  fontSize: 13,
  lineHeight: 1.2,
} as const;

const quietButtonSx = {
  color: "rgba(255,255,255,0.85)",
  borderColor: "rgba(255,255,255,0.35)",
  "&:hover": { borderColor: "rgba(255,255,255,0.6)" },
} as const;

const wagerFieldSx = {
  width: 190,
  "& .MuiInputBase-root": { background: "rgba(0,0,0,0.25)" },
  "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.7)" },
  "& .MuiFormHelperText-root": { color: "rgba(255,255,255,0.65)" },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.3)" },
} as const;
