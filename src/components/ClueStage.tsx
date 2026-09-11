"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PublicGameState } from "@/lib/game";
import { useGameStore } from "@/lib/state/game-store";
import {
  judgeAnswer as fuzzyJudge,
  playSfx,
  startFinalTheme,
  stopFinalTheme,
} from "@/lib/ai";
import {
  jeopardyClueShadow,
  jeopardyFonts,
  jeopardyPalette,
} from "@/lib/foundation/jeopardy-style";
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
  const [tickNow, setTickNow] = useState(() =>
    typeof window === "undefined" ? 0 : Date.now(),
  );
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

  if (!currentClue) return null;

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

  return (
    <Box
      data-testid="clue-stage"
      sx={{
        flex: 1,
        width: "100%",
        // A column of three parts: header, the clue, and the controls. Only
        // the clue may grow, and it scrolls inside its own space so a long
        // one never pushes the lights or the buzzer off the panel.
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
        position: "relative",
        px: { xs: 1.5, md: 5 },
        py: { xs: 1.5, md: 2 },
        gap: { xs: 0.5, md: 1 },
        background: `linear-gradient(180deg, ${jeopardyPalette.board} 0%, ${jeopardyPalette.boardShade} 100%)`,
      }}
    >
      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 1,
          flexShrink: 0,
        }}
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
        data-testid="clue-body"
        sx={{
          flex: "1 1 auto",
          // `minHeight: 0` is what actually lets this shrink: without it a
          // flex item refuses to go below its content height and overruns
          // everything below.
          minHeight: 0,
          overflowY: "auto",
          py: { xs: 1, md: 2 },
        }}
      >
        {/*
          Centring happens on this inner box, not on the scroll container: a
          flex parent with `align-items: center` pushes an over-tall child out
          of *both* ends, where the top can never be scrolled back into view.
        */}
        <Box
          sx={{
            minHeight: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
        {currentClue.clue ? (
          <Typography
            component="p"
            data-testid="clue-text"
            sx={{
              fontFamily: jeopardyFonts.clue,
              color: jeopardyPalette.clueText,
              textTransform: "uppercase",
              fontWeight: 600,
              textShadow: jeopardyClueShadow,
              // The show sets a long clue smaller so it still fits the
              // monitor; the size steps down with the character count.
              fontSize: clueFontSize(currentClue.clue.length),
              lineHeight: 1.22,
              // A long clue also gets a wider measure: more words per line
              // means fewer lines, so it stays on one screen.
              maxWidth: clueMeasure(currentClue.clue.length),
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
      </Box>

      <Box sx={{ flexShrink: 0 }}>
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
        <Box sx={{ display: "flex", justifyContent: "center", mt: 1.5 }}>
          <Button
            variant="contained"
            data-testid="next-clue"
            onClick={() => runtime?.sendCommand(currentClientId, { type: "skip" })}
            sx={{ minWidth: 160 }}
          >
            Next clue
          </Button>
        </Box>
      ) : null}
      </Box>
    </Box>
  );
}

/**
 * Clue type sizes down as the clue gets longer, the way the show sets a wordy
 * clue smaller rather than letting it overrun the monitor. Sized against the
 * board container so it tracks the panel, not the viewport.
 */
function clueFontSize(length: number): string {
  if (length <= 90) return "clamp(18px, 4.2cqw, 46px)";
  if (length <= 180) return "clamp(16px, 3.2cqw, 36px)";
  if (length <= 300) return "clamp(15px, 2.5cqw, 29px)";
  return "clamp(13px, 2cqw, 24px)";
}

function clueMeasure(length: number): string {
  if (length <= 90) return "22ch";
  if (length <= 180) return "30ch";
  if (length <= 300) return "38ch";
  return "46ch";
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
