"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import type { PublicGameState } from "@/lib/game";
import { useGameStore } from "@/lib/state/game-store";
import { createVoiceAdapter, judgeAnswer as fuzzyJudge } from "@/lib/ai";

interface ClueStageProps {
  state: PublicGameState;
  currentClientId: string;
  onClose?: () => void;
}

const voiceAdapter = typeof window === "undefined" ? null : createVoiceAdapter();

export function ClueStage({ state, currentClientId }: ClueStageProps) {
  const runtime = useGameStore((s) => s.runtime);
  const preferences = useGameStore((s) => s.preferences);
  const lobby = useGameStore((s) => s.lobby);
  const [wagerInput, setWagerInput] = useState<string>("");
  const [answerInput, setAnswerInput] = useState("");
  const [tickNow, setTickNow] = useState(() =>
    typeof window === "undefined" ? 0 : Date.now(),
  );
  const buzzerRef = useRef<HTMLButtonElement | null>(null);
  const spokenClueId = useRef<string | null>(null);
  const currentClue = state.currentClue;

  useEffect(() => {
    const id = setInterval(() => setTickNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const activeClueId = currentClue?.clueId ?? null;
  const [trackedClueId, setTrackedClueId] = useState<string | null>(null);
  if (trackedClueId !== activeClueId) {
    setTrackedClueId(activeClueId);
    setAnswerInput("");
    setWagerInput("");
  }
  useEffect(() => {
    if (activeClueId === null) {
      spokenClueId.current = null;
    }
  }, [activeClueId]);

  useEffect(() => {
    if (!currentClue) return;
    if (
      preferences.soundEnabled &&
      voiceAdapter &&
      currentClue.clue &&
      spokenClueId.current !== currentClue.clueId
    ) {
      spokenClueId.current = currentClue.clueId;
      voiceAdapter.speak({
        text: currentClue.clue,
        voiceProfileId: preferences.voiceProfileId,
      });
    }
  }, [currentClue, preferences.soundEnabled, preferences.voiceProfileId]);

  useEffect(() => {
    if (currentClue?.canBuzz && currentClue.buzzes[currentClientId] === undefined) {
      buzzerRef.current?.focus();
    }
  }, [currentClue?.canBuzz, currentClue?.buzzes, currentClientId]);

  const clueRevealed = currentClue?.clue !== undefined;
  const answerRevealed = currentClue?.correctResponse !== undefined;
  const isHostId = state.settings.hostId === currentClientId;
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
      if (event.code === "Space" && currentClue?.canBuzz && !inField) {
        event.preventDefault();
        sendCommand({ type: "buzz" });
        return;
      }
      if (inField) return;
      if (
        event.key.toLowerCase() === "r" &&
        !answerRevealed &&
        clueRevealed &&
        isHostId
      ) {
        event.preventDefault();
        sendCommand({ type: "reveal-answer" });
        return;
      }
      if (isHostId && answerRevealed && judgeTarget) {
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
      if (event.key.toLowerCase() === "s" && canAdvanceNow && isHostId) {
        event.preventDefault();
        sendCommand({ type: "skip" });
        return;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    currentClue,
    runtime,
    currentClientId,
    isHostId,
    canAdvanceNow,
    judgeTarget,
    answerRevealed,
    clueRevealed,
  ]);

  const isHost = state.settings.hostId === currentClientId;
  const isFinal = currentClue?.round === "final-jeopardy";
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

  if (!currentClue) {
    return (
      <Paper variant="outlined" sx={{ p: 3, height: "100%" }}>
        <Stack spacing={1}>
          <Typography variant="overline" color="text.secondary">
            Round
          </Typography>
          <Typography variant="h4" sx={{ textTransform: "capitalize" }}>
            {state.round.replace("-", " ")}
          </Typography>
          <Typography color="text.secondary">
            {state.round === "lobby"
              ? "Waiting to start."
              : state.round === "complete"
                ? "Game complete!"
                : state.pickerId
                  ? `${playerName(state, state.pickerId)} is picking the next clue.`
                  : "Awaiting a picker."}
          </Typography>
        </Stack>
      </Paper>
    );
  }

  function handleBuzz() {
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

  function handleReveal() {
    runtime?.sendCommand(currentClientId, { type: "reveal-answer" });
  }

  function handleJudge(correct: boolean | null) {
    if (!currentClue?.currentJudgePlayerId) return;
    runtime?.sendCommand(currentClientId, {
      type: "judge-answer",
      targetPlayerId: currentClue.currentJudgePlayerId,
      correct,
    });
  }

  function handleSkip() {
    runtime?.sendCommand(currentClientId, { type: "skip" });
  }

  const now = tickNow;
  const buzzReadyAt = currentClue.readoutEndsAt ?? now;
  const answerEndsAt = currentClue.answerWindowEndsAt ?? now;
  const wagerEndsAt = currentClue.wagerWindowEndsAt ?? now;

  const readoutProgress = clampProgress(buzzReadyAt - now, 3_000);
  const answerProgress = clampProgress(
    answerEndsAt - now,
    Math.max(answerEndsAt - buzzReadyAt, 1),
  );
  const wagerProgress = clampProgress(wagerEndsAt - now, 30_000);

  const buzzed = currentClue.buzzes[currentClientId] !== undefined;
  const canIBuzz = currentClue.canBuzz && !buzzed && currentClue.round !== "final-jeopardy";
  const submittedAnswer =
    currentClue.answers[currentClientId] ??
    (state.currentClue?.buzzes[currentClientId] === undefined ? undefined : "");

  const wagerSubmittedByMe =
    currentClue.wagers[currentClientId] !== undefined ||
    (!myWagerOpen && currentClue.waitingForWager.length === 0 && (isFinal || currentClue.dailyDouble));

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, md: 3 },
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minHeight: { xs: 320, md: 360 },
        background: "linear-gradient(135deg, rgba(31,63,191,0.25) 0%, rgba(8,11,18,0.6) 100%)",
        position: "relative",
      }}
    >
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ alignItems: "center", flexWrap: "wrap" }}
        >
          <Chip label={currentClue.category} color="primary" />
          <Chip
            label={`$${currentClue.value}`}
            sx={{ fontWeight: 700, fontSize: 16 }}
            color="secondary"
          />
          {currentClue.dailyDouble ? (
            <Chip label="Daily Double" color="warning" sx={{ fontWeight: 700 }} />
          ) : null}
          {isFinal ? <Chip label="Final Jeopardy" color="error" /> : null}
        </Stack>
        {preferences.soundEnabled ? <VolumeUpIcon color="action" /> : <VolumeOffIcon color="disabled" />}
      </Stack>

      {currentClue.waitingForWager.length > 0 && (
        <Box>
          <LinearProgress variant="determinate" value={wagerProgress} sx={{ height: 6, borderRadius: 3 }} />
          <Typography variant="caption" color="text.secondary">
            Wager window — {Math.max(0, Math.ceil((wagerEndsAt - now) / 1000))}s
          </Typography>
        </Box>
      )}

      {currentClue.clue ? (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            p: { xs: 2, md: 3 },
            minHeight: 160,
            transition: preferences.reducedMotion ? "none" : "background 0.3s ease",
          }}
        >
          <Typography
            variant="h4"
            sx={{
              fontSize: { xs: 22, sm: 28, md: 36 },
              fontWeight: 700,
              maxWidth: 720,
              lineHeight: 1.25,
              visibility: preferences.captionsEnabled ? "visible" : "hidden",
            }}
          >
            {currentClue.clue}
          </Typography>
          {!preferences.captionsEnabled ? (
            <Typography
              variant="body2"
              sx={{ position: "absolute", color: "text.secondary" }}
            >
              Listen for the clue…
            </Typography>
          ) : null}
        </Box>
      ) : (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "text.secondary",
            fontSize: 18,
          }}
        >
          {currentClue.waitingForWager.length > 0
            ? `Waiting for ${currentClue.waitingForWager
                .map((id) => playerName(state, id))
                .join(", ")} to wager…`
            : "Preparing clue…"}
        </Box>
      )}

      {clueRevealed && !answerRevealed ? (
        <Box>
          {readoutProgress > 0 ? (
            <>
              <LinearProgress
                variant="determinate"
                value={100 - readoutProgress}
                color="info"
                sx={{ height: 6, borderRadius: 3 }}
              />
              <Typography variant="caption" color="text.secondary">
                Reading clue… buzz unlocks in{" "}
                {Math.max(0, Math.ceil((buzzReadyAt - now) / 100) / 10)}s
              </Typography>
            </>
          ) : (
            <>
              <LinearProgress
                variant="determinate"
                value={100 - answerProgress}
                color="warning"
                sx={{ height: 6, borderRadius: 3 }}
              />
              <Typography variant="caption" color="text.secondary">
                Answer window — {Math.max(0, Math.ceil((answerEndsAt - now) / 1000))}s
              </Typography>
            </>
          )}
        </Box>
      ) : null}

      {answerRevealed ? (
        <Stack spacing={1}>
          <Typography variant="overline" color="success.light">
            Correct response
          </Typography>
          <Typography variant="h5" color="success.light">
            {currentClue.correctResponse}
          </Typography>
        </Stack>
      ) : null}

      {/* Wager input */}
      {myWagerOpen && !wagerSubmittedByMe ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <TextField
            label={`Wager (min $${wagerLimits.min}, max $${wagerLimits.max})`}
            type="number"
            value={wagerInput}
            onChange={(event) => setWagerInput(event.target.value)}
            slotProps={{
              htmlInput: { min: wagerLimits.min, max: wagerLimits.max },
            }}
            size="small"
            autoFocus
          />
          <Button variant="contained" onClick={handleSubmitWager}>
            Submit wager
          </Button>
        </Stack>
      ) : null}

      {/* Buzzer */}
      {!isFinal && clueRevealed && !answerRevealed ? (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ alignItems: { sm: "center" } }}
        >
          <Button
            ref={buzzerRef}
            onClick={handleBuzz}
            disabled={!canIBuzz}
            variant="contained"
            color="error"
            size="large"
            sx={{
              minWidth: 180,
              py: 1.5,
              fontSize: 18,
              borderRadius: 999,
              boxShadow: canIBuzz ? 6 : "none",
              opacity: canIBuzz ? 1 : 0.5,
            }}
            aria-label="Buzz in"
          >
            {buzzed ? "Buzzed!" : canIBuzz ? "BUZZ (Space)" : "Locked"}
          </Button>
          {buzzed && !answerRevealed ? (
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flex: 1 }}
            >
              <TextField
                fullWidth
                size="small"
                label="Your answer"
                value={answerInput}
                onChange={(event) => setAnswerInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSubmitAnswer();
                  }
                }}
                autoFocus
                disabled={Boolean(submittedAnswer)}
              />
              <Button
                variant="contained"
                onClick={handleSubmitAnswer}
                disabled={!answerInput.trim() || Boolean(submittedAnswer)}
              >
                Send
              </Button>
            </Stack>
          ) : null}
        </Stack>
      ) : null}

      {/* Final answer input */}
      {isFinal && !answerRevealed && clueRevealed ? (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: { sm: "center" } }}
        >
          <TextField
            fullWidth
            label="Your final answer"
            value={answerInput}
            onChange={(event) => setAnswerInput(event.target.value)}
            disabled={Boolean(submittedAnswer)}
          />
          <Button
            variant="contained"
            disabled={!answerInput.trim() || Boolean(submittedAnswer)}
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
          sx={{ flexWrap: "wrap" }}
        >
          <Button variant="outlined" onClick={handleReveal}>
            Reveal answer
          </Button>
          {state.settings.aiJudgeEnabled && Object.keys(currentClue.buzzes).length > 0 ? (
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => {
                if (!runtime) return;
                runtime.sendCommand(currentClientId, { type: "reveal-answer" });
                setTimeout(() => {
                  const updated = useGameStore.getState().publicState?.currentClue;
                  if (!updated) return;
                  const queue = Object.keys(updated.answers).sort(
                    (a, b) => (updated.buzzes[a] ?? 0) - (updated.buzzes[b] ?? 0),
                  );
                  for (const playerId of queue) {
                    const latest = useGameStore.getState().publicState?.currentClue;
                    if (!latest) break;
                    if (latest.canAdvance) break;
                    if (latest.judges[playerId] !== undefined) continue;
                    runtime.judgeWithAi(playerId);
                  }
                  setTimeout(() => {
                    runtime.sendCommand(currentClientId, { type: "skip" });
                  }, 1200);
                }, 100);
              }}
            >
              Auto-judge with AI
            </Button>
          ) : null}
        </Stack>
      ) : null}

      {isHost && answerRevealed && currentClue.currentJudgePlayerId ? (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Judging {playerName(state, currentClue.currentJudgePlayerId)}:{" "}
            <Box component="span" sx={{ color: "secondary.light" }}>
              {currentClue.answers[currentClue.currentJudgePlayerId] || "(no answer)"}
            </Box>
          </Typography>
          {(() => {
            const target = currentClue.currentJudgePlayerId;
            if (!target) return null;
            const verdict = fuzzyJudge({
              submittedAnswer: currentClue.answers[target] ?? "",
              expectedAnswer: currentClue.correctResponse ?? "",
            });
            return (
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                sx={{ mb: 1, alignItems: "center", flexWrap: "wrap" }}
              >
                <Chip
                  size="small"
                  label={`AI: ${verdict.correct ? "Correct" : "Incorrect"} (${Math.round(verdict.confidence * 100)}%)`}
                  color={verdict.correct ? "success" : "error"}
                  variant="outlined"
                />
                <Typography variant="caption" color="text.secondary">
                  {verdict.reason}
                </Typography>
              </Stack>
            );
          })()}
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
          >
            <Button variant="contained" color="success" onClick={() => handleJudge(true)}>
              Correct
            </Button>
            <Button variant="contained" color="error" onClick={() => handleJudge(false)}>
              Incorrect
            </Button>
            <Button variant="outlined" onClick={() => handleJudge(null)}>
              Discard
            </Button>
            {state.settings.aiJudgeEnabled ? (
              <Button
                variant="outlined"
                onClick={() => {
                  if (!currentClue.currentJudgePlayerId) return;
                  runtime?.judgeWithAi(currentClue.currentJudgePlayerId);
                }}
              >
                Ask AI judge
              </Button>
            ) : (
              <Button
                variant="outlined"
                onClick={() => {
                  if (!currentClue.currentJudgePlayerId) return;
                  const verdict = fuzzyJudge({
                    submittedAnswer:
                      currentClue.answers[currentClue.currentJudgePlayerId] ?? "",
                    expectedAnswer: currentClue.correctResponse ?? "",
                  });
                  alert(
                    `AI suggests: ${verdict.correct ? "Correct" : "Incorrect"} (${(verdict.confidence * 100).toFixed(0)}% match — ${verdict.reason}).`,
                  );
                }}
              >
                Suggest with AI
              </Button>
            )}
          </Stack>
        </Box>
      ) : null}

      {isHost && currentClue.canAdvance ? (
        <Button
          variant="contained"
          color="primary"
          onClick={handleSkip}
          sx={{ alignSelf: "flex-end" }}
        >
          {lobby.hostControlsAuto ? "Next clue" : "Advance"}
        </Button>
      ) : null}

      {submittedAnswer ? (
        <Typography variant="caption" color="text.secondary">
          Your answer is locked in.
        </Typography>
      ) : null}
    </Paper>
  );
}

function clampProgress(remaining: number, total: number) {
  if (total <= 0) return 0;
  const progress = (remaining / total) * 100;
  return Math.max(0, Math.min(100, progress));
}

function playerName(state: PublicGameState, id: string) {
  return state.players.find((player) => player.id === id)?.displayName ?? id;
}
