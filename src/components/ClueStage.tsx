"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { PublicGameState } from "@/lib/game";
import { useGameStore } from "@/lib/state/game-store";
import {
  judgeAnswer as fuzzyJudge,
  playSfx,
  primeAudio,
  primeSpeech,
  startFinalTheme,
  stopFinalTheme,
} from "@/lib/ai";
import {
  jeopardyClueShadow,
  jeopardyFonts,
  jeopardyPalette,
} from "@/lib/foundation/jeopardy-style";
import { MicAnswerField } from "./MicAnswerField";
import { DailyDoubleSplash } from "./DailyDoubleSplash";
import { BuzzLights } from "./BuzzLights";

interface ClueStageProps {
  state: PublicGameState;
  currentClientId: string;
  onClose?: () => void;
}

export function ClueStage({ state, currentClientId }: ClueStageProps) {
  const runtime = useGameStore((s) => s.runtime);
  const preferences = useGameStore((s) => s.preferences);
  const [wagerInput, setWagerInput] = useState<string>("");
  const [answerInput, setAnswerInput] = useState("");
  const [tickNow, setTickNow] = useState(() =>
    typeof window === "undefined" ? 0 : Date.now(),
  );
  const buzzerRef = useRef<HTMLButtonElement | null>(null);
  const currentClue = state.currentClue;

  useEffect(() => {
    const id = setInterval(() => setTickNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const activeClueId = currentClue?.clueId ?? null;
  const [trackedClueId, setTrackedClueId] = useState<string | null>(null);
  const [ddSplashId, setDdSplashId] = useState<string | null>(null);
  const [ddSplashVisible, setDdSplashVisible] = useState(false);
  if (trackedClueId !== activeClueId) {
    setTrackedClueId(activeClueId);
    setAnswerInput("");
    setWagerInput("");
  }

  // Daily Double splash while the wager is open, before the clue is read.
  const shouldTriggerDdSplash =
    Boolean(currentClue?.dailyDouble) &&
    currentClue?.waitingForWager.length !== 0 &&
    ddSplashId !== (currentClue?.clueId ?? null);
  if (shouldTriggerDdSplash && currentClue) {
    setDdSplashId(currentClue.clueId);
    setDdSplashVisible(true);
    if (preferences.soundEnabled) playSfx("daily-double");
  }
  useEffect(() => {
    if (!ddSplashVisible) return;
    const id = setTimeout(() => setDdSplashVisible(false), 1_600);
    return () => clearTimeout(id);
  }, [ddSplashVisible]);

  // Final Jeopardy countdown — runs while the clue is live, stops on reveal.
  const finalThemeArmed = useRef<string | null>(null);
  const isFinal = currentClue?.round === "final-jeopardy";
  const answerRevealed = currentClue?.correctResponse !== undefined;
  useEffect(() => {
    if (!currentClue || !isFinal || answerRevealed || !preferences.soundEnabled) {
      if (!currentClue || answerRevealed) {
        stopFinalTheme();
        finalThemeArmed.current = null;
      }
      return;
    }
    if (finalThemeArmed.current === currentClue.clueId) return;
    finalThemeArmed.current = currentClue.clueId;
    startFinalTheme(30);
  }, [currentClue, isFinal, answerRevealed, preferences.soundEnabled]);

  useEffect(() => () => stopFinalTheme(), []);

  useEffect(() => {
    if (currentClue?.canBuzz && currentClue.buzzes[currentClientId] === undefined) {
      buzzerRef.current?.focus();
    }
  }, [currentClue?.canBuzz, currentClue?.buzzes, currentClientId]);

  const clueRevealed = currentClue?.clue !== undefined;
  const isHost = state.settings.hostId === currentClientId;
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
      if (event.key.toLowerCase() === "r" && !answerRevealed && clueRevealed && isHost) {
        event.preventDefault();
        sendCommand({ type: "reveal-answer" });
        return;
      }
      if (isHost && answerRevealed && judgeTarget) {
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
      if (event.key.toLowerCase() === "s" && canAdvanceNow && isHost) {
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
    isHost,
    canAdvanceNow,
    judgeTarget,
    answerRevealed,
    clueRevealed,
  ]);

  const myScore =
    state.players.find((player) => player.id === currentClientId)?.score ?? 0;
  const myWagerOpen = currentClue?.waitingForWager.includes(currentClientId) ?? false;
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

  function handleBuzz() {
    primeAudio();
    primeSpeech();
    runtime?.sendCommand(currentClientId, { type: "buzz" });
  }

  function handleSubmitAnswer() {
    const text = answerInput.trim();
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

  const now = tickNow;
  const readoutEndsAt = currentClue.readoutEndsAt ?? now;
  const buzzWindowEndsAt = currentClue.buzzWindowEndsAt ?? now;
  const answerEndsAt = currentClue.answerWindowEndsAt ?? now;
  const wagerEndsAt = currentClue.wagerWindowEndsAt ?? now;
  const wagerWindowMs = Math.max(
    1,
    wagerEndsAt - (currentClue.wagerWindowStartsAt ?? wagerEndsAt - 20_000),
  );

  const inReadout = now < readoutEndsAt;
  const buzzedIds = Object.keys(currentClue.buzzes);
  const someoneBuzzed = buzzedIds.length > 0;
  const buzzedByMe = currentClue.buzzes[currentClientId] !== undefined;
  const iSubmitted = Boolean(currentClue.submitted[currentClientId]);
  const lockedUntil = currentClue.lockouts[currentClientId] ?? 0;
  const isLockedOut = now < lockedUntil;

  const buzzWindowOpen =
    !inReadout && now <= buzzWindowEndsAt && !someoneBuzzed && !answerRevealed;
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

  const lightsRemaining = (() => {
    if (currentClue.waitingForWager.length > 0) {
      return fraction(wagerEndsAt - now, wagerWindowMs);
    }
    if (someoneBuzzed || isFinal || currentClue.dailyDouble) {
      const total = isFinal ? 30_000 : 10_000;
      return fraction(answerEndsAt - now, total);
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

  const wagerSubmittedByMe =
    currentClue.wagers[currentClientId] !== undefined ||
    (!myWagerOpen &&
      currentClue.waitingForWager.length === 0 &&
      (isFinal || currentClue.dailyDouble));

  return (
    <Box
      data-testid="clue-stage"
      sx={{
        flex: 1,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        px: { xs: 1.5, md: 5 },
        py: { xs: 1.5, md: 3 },
        // Keep the buzzer reachable when a long clue fills a small screen.
        overflowY: "auto",
        background: `linear-gradient(180deg, ${jeopardyPalette.board} 0%, ${jeopardyPalette.boardShade} 100%)`,
      }}
    >
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "baseline", gap: 1 }}
      >
        <Typography
          sx={{
            fontFamily: jeopardyFonts.display,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.72)",
            fontSize: { xs: 11, sm: 14 },
          }}
        >
          {currentClue.category}
        </Typography>
        <Typography
          sx={{
            fontFamily: jeopardyFonts.display,
            color: jeopardyPalette.gold,
            fontWeight: 700,
            fontSize: { xs: 14, sm: 20 },
            textShadow: jeopardyClueShadow,
          }}
        >
          {currentClue.dailyDouble
            ? `DAILY DOUBLE${
                currentClue.wagers[currentClue.dailyDoublePlayerId ?? ""] !== undefined
                  ? ` · $${currentClue.wagers[currentClue.dailyDoublePlayerId ?? ""]}`
                  : ""
              }`
            : isFinal
              ? "FINAL JEOPARDY!"
              : `$${currentClue.value}`}
        </Typography>
      </Stack>

      <DailyDoubleSplash
        visible={ddSplashVisible}
        reducedMotion={preferences.reducedMotion}
      />

      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          py: { xs: 2, md: 4 },
          minHeight: { xs: 140, md: 200 },
        }}
      >
        {currentClue.clue ? (
          <Typography
            component="p"
            sx={{
              fontFamily: jeopardyFonts.clue,
              color: jeopardyPalette.clueText,
              textTransform: "uppercase",
              fontWeight: 600,
              textShadow: jeopardyClueShadow,
              fontSize: "clamp(18px, 3.4vw, 48px)",
              lineHeight: 1.22,
              maxWidth: "22ch",
              letterSpacing: "0.005em",
              animation: preferences.reducedMotion ? "none" : "clue-in 260ms ease-out both",
              "@keyframes clue-in": {
                from: { opacity: 0 },
                to: { opacity: 1 },
              },
            }}
          >
            {currentClue.clue}
          </Typography>
        ) : (
          <Typography
            sx={{
              fontFamily: jeopardyFonts.display,
              color: "rgba(255,255,255,0.65)",
              fontSize: { xs: 16, md: 24 },
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {currentClue.waitingForWager.length > 0
              ? `Wager · ${currentClue.waitingForWager
                  .map((id) => playerName(state, id))
                  .join(", ")}`
              : ""}
          </Typography>
        )}
      </Box>

      {answerRevealed ? (
        <Typography
          data-testid="correct-response"
          sx={{
            fontFamily: jeopardyFonts.clue,
            textAlign: "center",
            color: jeopardyPalette.goldBright,
            textTransform: "uppercase",
            fontWeight: 700,
            fontSize: "clamp(16px, 2.4vw, 34px)",
            textShadow: jeopardyClueShadow,
            mb: 1.5,
            animation: preferences.reducedMotion ? "none" : "clue-in 220ms ease-out both",
          }}
        >
          {currentClue.correctResponse}
        </Typography>
      ) : null}

      {!answerRevealed ? (
        <Stack spacing={1.25} sx={{ alignItems: "center", mb: 1 }}>
          <BuzzLights
            remaining={lightsRemaining}
            reducedMotion={preferences.reducedMotion}
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
              minHeight: 16,
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

      {myWagerOpen && !wagerSubmittedByMe && !ddSplashVisible ? (
        <Stack spacing={1} sx={{ alignItems: "center", mb: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
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
            <Button variant="contained" onClick={handleSubmitWager} sx={{ mb: 2.5 }}>
              Wager
            </Button>
          </Stack>
          <Stack direction="row" spacing={1}>
            {!isFinal ? (
              <Button
                size="small"
                sx={hostButtonSx}
                onClick={() => setWagerInput(String(currentClue.value))}
              >
                ${currentClue.value}
              </Button>
            ) : null}
            <Button
              size="small"
              sx={hostButtonSx}
              onClick={() => setWagerInput(String(wagerLimits.max))}
            >
              {isFinal ? "Everything" : "True Daily Double"}
            </Button>
          </Stack>
        </Stack>
      ) : null}

      {/* Buzzer and answer entry */}
      {!isFinal && clueRevealed && !answerRevealed ? (
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
              aria-label="Buzz in"
            >
              {buzzedByMe ? "IN!" : isLockedOut ? "LOCKED" : "BUZZ"}
            </Button>
          ) : null}

          {(buzzedByMe || currentClue.dailyDouble) && !iSubmitted ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flex: 1, maxWidth: 520 }}>
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
                onClick={handleSubmitAnswer}
                disabled={!answerInput.trim() || iSubmitted}
              >
                Send
              </Button>
            </Stack>
          ) : null}
          {iSubmitted ? (
            <Typography sx={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
              Answer locked in
            </Typography>
          ) : null}
        </Stack>
      ) : null}

      {/* Final Jeopardy answer */}
      {isFinal && !answerRevealed && clueRevealed && !iSubmitted ? (
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
            onClick={handleSubmitAnswer}
          >
            Lock in
          </Button>
        </Stack>
      ) : null}

      {/* Host controls */}
      {isHost && clueRevealed && !answerRevealed ? (
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ flexWrap: "wrap", justifyContent: "center", mt: 1.5 }}
        >
          <Button
            variant="outlined"
            sx={hostButtonSx}
            onClick={() => runtime?.sendCommand(currentClientId, { type: "reveal-answer" })}
          >
            Reveal
          </Button>
        </Stack>
      ) : null}

      {isHost && answerRevealed && currentClue.currentJudgePlayerId ? (
        <JudgePanel
          state={state}
          target={currentClue.currentJudgePlayerId}
          answer={currentClue.answers[currentClue.currentJudgePlayerId] ?? ""}
          expected={currentClue.correctResponse ?? ""}
          wager={currentClue.wagers[currentClue.currentJudgePlayerId]}
          onJudge={handleJudge}
        />
      ) : null}

      {isHost && currentClue.canAdvance ? (
        <Button
          variant="contained"
          onClick={() => runtime?.sendCommand(currentClientId, { type: "skip" })}
          sx={{ alignSelf: "center", mt: 1.5, minWidth: 160 }}
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
    <Box sx={{ mt: 1.5, textAlign: "center" }}>
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
          <Box
            component="span"
            sx={{ fontSize: 13, color: jeopardyPalette.gold, ml: 1 }}
          >
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
        <Button variant="outlined" sx={hostButtonSx} onClick={() => onJudge(null)}>
          Skip
        </Button>
      </Stack>
    </Box>
  );
}

const hostButtonSx = {
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
