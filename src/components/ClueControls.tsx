"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

interface ClueControlsProps {
  state: PublicGameState;
  currentClientId: string;
}

/**
 * Everything about a clue that isn't the clue: the clock, the buzzer, the
 * answer, the wager, and the host's reveal and judging.
 *
 * All of it used to sit inside the clue panel, on the board — the clue
 * sharing a rectangle with the controls for answering it, the buzzer
 * shifting as a field appeared beside it, a long clue squeezed by the row
 * underneath. The board carries the clue; this strip under it carries the
 * doing. The one stays what the room reads, the other stays where your hands
 * are.
 */
export function ClueControls({ state, currentClientId }: ClueControlsProps) {
  const runtime = useGameStore((s) => s.runtime);
  const reducedMotion = useGameStore((s) => s.preferences.reducedMotion);
  const [answerInput, setAnswerInput] = useState("");
  const [wagerInput, setWagerInput] = useState("");
  const [now, setNow] = useState(() => (typeof window === "undefined" ? 0 : Date.now()));
  const buzzerRef = useRef<HTMLButtonElement | null>(null);
  const currentClue = state.currentClue;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  // A new clue clears whatever was half-typed for the last one.
  const activeClueId = currentClue?.clueId ?? null;
  const [trackedClueId, setTrackedClueId] = useState<string | null>(null);
  if (trackedClueId !== activeClueId) {
    setTrackedClueId(activeClueId);
    setAnswerInput("");
    setWagerInput("");
  }

  useEffect(() => {
    if (currentClue?.canBuzz && currentClue.buzzes[currentClientId] === undefined) {
      buzzerRef.current?.focus();
    }
  }, [currentClue?.canBuzz, currentClue?.buzzes, currentClientId]);

  // Read before the early return below, because hooks must be.
  const iAmHost = state.settings.hostId === currentClientId;
  const clueRevealed = currentClue?.clue !== undefined;
  const answerRevealed = currentClue?.correctResponse !== undefined;
  const canAdvanceNow = Boolean(currentClue?.canAdvance);
  const judgeTarget = currentClue?.currentJudgePlayerId;

  useEffect(() => {
    if (!currentClue) return;
    function sendCommand(command: Parameters<NonNullable<typeof runtime>["sendCommand"]>[1]) {
      runtime?.sendCommand(currentClientId, command);
    }
    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const inField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (event.code === "Space" && !inField && currentClue && !answerRevealed) {
        event.preventDefault();
        sendCommand({ type: "buzz" });
        return;
      }
      if (inField) return;
      if (event.key.toLowerCase() === "r" && !answerRevealed && clueRevealed && iAmHost) {
        event.preventDefault();
        sendCommand({ type: "reveal-answer" });
        return;
      }
      if (iAmHost && answerRevealed && judgeTarget) {
        if (event.key.toLowerCase() === "y") {
          event.preventDefault();
          sendCommand({ type: "judge-answer", targetPlayerId: judgeTarget, correct: true });
          return;
        }
        if (event.key.toLowerCase() === "n") {
          event.preventDefault();
          sendCommand({ type: "judge-answer", targetPlayerId: judgeTarget, correct: false });
          return;
        }
      }
      if (event.key.toLowerCase() === "s" && canAdvanceNow && iAmHost) {
        event.preventDefault();
        sendCommand({ type: "skip" });
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    currentClue,
    runtime,
    currentClientId,
    iAmHost,
    canAdvanceNow,
    judgeTarget,
    answerRevealed,
    clueRevealed,
  ]);

  const myScore =
    state.players.find((player) => player.id === currentClientId)?.score ?? 0;
  const wagerLimits = useMemo(() => {
    if (!currentClue) return { min: 0, max: 0 };
    if (currentClue.round === "final-jeopardy") {
      return { min: 0, max: Math.max(0, myScore) };
    }
    return {
      min: 5,
      max: Math.max(
        myScore,
        currentClue.round === "double-jeopardy"
          ? 2_000
          : currentClue.round === "triple-jeopardy"
            ? 3_000
            : 1_000,
      ),
    };
  }, [currentClue, myScore]);

  if (!currentClue) return null;

  const isFinal = currentClue.round === "final-jeopardy";
  const buzzedByMe = currentClue.buzzes[currentClientId] !== undefined;
  const iSubmitted = Boolean(currentClue.submitted[currentClientId]);
  const isLockedOut = now < (currentClue.lockouts[currentClientId] ?? 0);
  const myWagerOpen = currentClue.waitingForWager.includes(currentClientId);
  const wagerSubmittedByMe =
    currentClue.wagers[currentClientId] !== undefined ||
    (!myWagerOpen &&
      currentClue.waitingForWager.length === 0 &&
      (isFinal || currentClue.dailyDouble));

  const buzzedIds = Object.keys(currentClue.buzzes);
  const someoneBuzzed = buzzedIds.length > 0;
  const readoutEndsAt = currentClue.readoutEndsAt ?? now;
  const buzzWindowEndsAt = currentClue.buzzWindowEndsAt ?? now;
  const answerEndsAt = currentClue.answerWindowEndsAt ?? now;
  const wagerEndsAt = currentClue.wagerWindowEndsAt ?? now;
  const wagerWindowMs = Math.max(
    1,
    wagerEndsAt - (currentClue.wagerWindowStartsAt ?? wagerEndsAt - 20_000),
  );
  const inReadout = now < readoutEndsAt;
  const buzzWindowOpen =
    !inReadout &&
    now <= (currentClue.buzzWindowEndsAt ?? now) &&
    !someoneBuzzed &&
    !answerRevealed;
  const canIBuzz =
    !buzzedByMe &&
    !isLockedOut &&
    !isFinal &&
    !currentClue.dailyDouble &&
    currentClue.waitingForWager.length === 0 &&
    clueRevealed &&
    !answerRevealed &&
    currentClue.judges[currentClientId] === undefined &&
    buzzWindowOpen;

  function handleBuzz() {
    primeAudio();
    primeSpeech();
    runtime?.sendCommand(currentClientId, { type: "buzz" });
  }

  function handleSubmitAnswer(dictated?: string) {
    const text = (dictated ?? answerInput).trim();
    if (!text) return;
    runtime?.sendCommand(currentClientId, { type: "submit-answer", answer: text });
    setAnswerInput("");
  }

  function handleSubmitWager() {
    const amount = Math.round(Number(wagerInput));
    if (!Number.isFinite(amount)) return;
    runtime?.sendCommand(currentClientId, { type: "submit-wager", amount });
  }

  function handleJudge(correct: boolean | null) {
    if (!currentClue?.currentJudgePlayerId) return;
    runtime?.sendCommand(currentClientId, {
      type: "judge-answer",
      targetPlayerId: currentClue.currentJudgePlayerId,
      correct,
    });
  }

  // How much of the current window is left, whichever window that is.
  const lightsRemaining = (() => {
    if (currentClue.waitingForWager.length > 0) {
      return fraction(wagerEndsAt - now, wagerWindowMs);
    }
    if (someoneBuzzed || isFinal || currentClue.dailyDouble) {
      return fraction(answerEndsAt - now, isFinal ? 30_000 : 10_000);
    }
    if (inReadout) return 1;
    return fraction(buzzWindowEndsAt - now, Math.max(1, buzzWindowEndsAt - readoutEndsAt));
  })();

  const firstBuzzerName = someoneBuzzed
    ? playerName(
        state,
        buzzedIds.sort(
          (a, b) => (currentClue.buzzes[a] ?? 0) - (currentClue.buzzes[b] ?? 0),
        )[0],
      )
    : null;

  const wagerOpen = myWagerOpen && !wagerSubmittedByMe;
  const buzzerOpen = !isFinal && clueRevealed && !answerRevealed;
  const finalOpen = isFinal && clueRevealed && !answerRevealed && !iSubmitted;

  return (
    <Box
      data-testid="player-controls"
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
          sx={{ alignItems: "center", justifyContent: "center" }}
        >
          <BuzzLights
            remaining={lightsRemaining}
            reducedMotion={reducedMotion}
            label={
              inReadout
                ? "Reading the clue"
                : someoneBuzzed
                  ? "Answer time remaining"
                  : "Time to ring in"
            }
          />
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
            {currentClue.waitingForWager.length > 0
              ? `Wager closes in ${seconds(wagerEndsAt - now)}s`
              : inReadout
                ? "Reading…"
                : someoneBuzzed
                  ? `${firstBuzzerName} rang in · ${seconds(answerEndsAt - now)}s`
                  : `Ring in · ${seconds(buzzWindowEndsAt - now)}s`}
          </Typography>
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
              helperText={`$${wagerLimits.min} – $${wagerLimits.max}`}
              slotProps={{ htmlInput: { min: wagerLimits.min, max: wagerLimits.max } }}
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
                onClick={() => setWagerInput(String(currentClue.value))}
              >
                ${currentClue.value}
              </Button>
            ) : null}
            <Button
              size="small"
              sx={quietButtonSx}
              onClick={() => setWagerInput(String(wagerLimits.max))}
            >
              {isFinal ? "Everything" : "True Daily Double"}
            </Button>
          </Stack>
        </Stack>
      ) : null}

      {buzzerOpen ? (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ alignItems: "center", justifyContent: "center" }}
        >
          {!currentClue.dailyDouble ? (
            <Button
              ref={buzzerRef}
              onClick={handleBuzz}
              disabled={!canIBuzz}
              variant="contained"
              size="large"
              data-testid="buzzer"
              aria-label="Buzz in"
              sx={{
                minWidth: 200,
                py: 1.4,
                fontFamily: jeopardyFonts.display,
                fontSize: 20,
                letterSpacing: "0.12em",
                borderRadius: 999,
                background: canIBuzz
                  ? "linear-gradient(180deg, #ff5f6d 0%, #c31432 100%)"
                  : "rgba(255,255,255,0.10)",
                color: canIBuzz ? "#fff" : "rgba(255,255,255,0.45)",
                boxShadow: canIBuzz ? "0 0 24px rgba(255,80,90,0.55)" : "none",
                "&.Mui-disabled": {
                  background: "rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.45)",
                },
              }}
            >
              {buzzedByMe ? "IN!" : isLockedOut ? "LOCKED" : "BUZZ"}
            </Button>
          ) : null}

          {iAmHost && clueRevealed ? (
            <Button
              variant="outlined"
              sx={quietButtonSx}
              onClick={() =>
                runtime?.sendCommand(currentClientId, { type: "reveal-answer" })
              }
            >
              Reveal
            </Button>
          ) : null}
        </Stack>
      ) : null}

      {buzzerOpen && (buzzedByMe || currentClue.dailyDouble) && !iSubmitted ? (
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", width: "100%", maxWidth: 520 }}
        >
          <MicAnswerField
            label="What is…"
            value={answerInput}
            onChange={setAnswerInput}
            onSubmit={handleSubmitAnswer}
            disabled={iSubmitted}
            autoFocus
          />
          <Button
            variant="contained"
            onClick={() => handleSubmitAnswer()}
            disabled={!answerInput.trim() || iSubmitted}
          >
            Send
          </Button>
        </Stack>
      ) : null}

      {finalOpen ? (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: "center", justifyContent: "center" }}
        >
          <MicAnswerField
            label="Final answer"
            value={answerInput}
            onChange={setAnswerInput}
            onSubmit={handleSubmitAnswer}
            disabled={iSubmitted}
            size="small"
          />
          <Button
            variant="contained"
            disabled={!answerInput.trim() || iSubmitted}
            onClick={() => handleSubmitAnswer()}
          >
            Lock in
          </Button>
        </Stack>
      ) : null}

      {/* Its own line: beside the buzzer it would drag the pill off centre the
          moment an answer went in. */}
      {iSubmitted && !answerRevealed ? (
        <Typography sx={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
          Answer locked in
        </Typography>
      ) : null}

      {iAmHost && clueRevealed && !answerRevealed && (isFinal || !buzzerOpen) ? (
        <Button
          variant="outlined"
          sx={quietButtonSx}
          onClick={() => runtime?.sendCommand(currentClientId, { type: "reveal-answer" })}
        >
          Reveal
        </Button>
      ) : null}

      {iAmHost && answerRevealed && currentClue.currentJudgePlayerId ? (
        <JudgePanel
          state={state}
          target={currentClue.currentJudgePlayerId}
          answer={currentClue.answers[currentClue.currentJudgePlayerId] ?? ""}
          expected={currentClue.correctResponse ?? ""}
          wager={currentClue.wagers[currentClue.currentJudgePlayerId]}
          onJudge={handleJudge}
        />
      ) : null}

      {iAmHost && currentClue.canAdvance ? (
        <Button
          variant="contained"
          data-testid="next-clue"
          onClick={() => runtime?.sendCommand(currentClientId, { type: "skip" })}
          sx={{ minWidth: 160 }}
        >
          Next clue
        </Button>
      ) : null}
    </Box>
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
  return (
    <Box sx={{ textAlign: "center" }}>
      <Typography sx={{ color: "rgba(255,255,255,0.85)", mb: 1, fontSize: 15 }}>
        {playerName(state, target)}:{" "}
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

function fraction(remaining: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, remaining / total));
}

function seconds(remaining: number) {
  return Math.max(0, Math.ceil(remaining / 1000));
}

function playerName(state: PublicGameState, id: string) {
  return state.players.find((player) => player.id === id)?.displayName ?? id;
}

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
