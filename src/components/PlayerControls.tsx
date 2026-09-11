"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { PublicGameState } from "@/lib/game";
import { useGameStore } from "@/lib/state/game-store";
import { primeAudio, primeSpeech } from "@/lib/ai";
import { jeopardyFonts } from "@/lib/foundation/jeopardy-style";
import { MicAnswerField } from "./MicAnswerField";

interface PlayerControlsProps {
  state: PublicGameState;
  currentClientId: string;
}

/**
 * Your half of the clue: the buzzer, the answer, the wager.
 *
 * These used to sit inside the clue panel, which meant they lived on the
 * board — the clue and the thing you press to answer it fighting for the
 * same rectangle, the buzzer shifting as an answer field appeared beside
 * it. They belong down here instead, over the lecterns: the board says what
 * the clue is, this row is where you do something about it, and a glance
 * never has to leave your own end of the screen.
 */
export function PlayerControls({ state, currentClientId }: PlayerControlsProps) {
  const runtime = useGameStore((s) => s.runtime);
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
  const clueRevealed = currentClue.clue !== undefined;
  const answerRevealed = currentClue.correctResponse !== undefined;
  const buzzedByMe = currentClue.buzzes[currentClientId] !== undefined;
  const iSubmitted = Boolean(currentClue.submitted[currentClientId]);
  const isLockedOut = now < (currentClue.lockouts[currentClientId] ?? 0);
  const myWagerOpen = currentClue.waitingForWager.includes(currentClientId);
  const wagerSubmittedByMe =
    currentClue.wagers[currentClientId] !== undefined ||
    (!myWagerOpen &&
      currentClue.waitingForWager.length === 0 &&
      (isFinal || currentClue.dailyDouble));

  const someoneBuzzed = Object.keys(currentClue.buzzes).length > 0;
  const inReadout = now < (currentClue.readoutEndsAt ?? now);
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

  const wagerOpen = myWagerOpen && !wagerSubmittedByMe;
  const buzzerOpen = !isFinal && clueRevealed && !answerRevealed;
  const finalOpen = isFinal && clueRevealed && !answerRevealed && !iSubmitted;
  if (!wagerOpen && !buzzerOpen && !finalOpen) return null;

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

          {(buzzedByMe || currentClue.dailyDouble) && !iSubmitted ? (
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flex: 1, maxWidth: 520 }}
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
    </Box>
  );
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
