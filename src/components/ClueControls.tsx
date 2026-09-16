"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import SendIcon from "@mui/icons-material/SendOutlined";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { PublicGameState } from "@/lib/game";
import { useGameStore } from "@/lib/state/game-store";
import { controls, ui } from "@/lib/foundation/jeopardy-style";
import { MicAnswerField } from "./MicAnswerField";
import { BuzzLights } from "./BuzzLights";
import { Housing, HousingDivider, HousingLabel } from "./Housing";
import { JudgeBench } from "./clue/JudgeBench";
import { benchKeySx, wrapHousingSx } from "./clue/bench-style";
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
        // One instrument: the lamps, the countdown and — while the clock is
        // yours — the answer field share a housing. The field takes the
        // phase's place on a wide screen and a row of its own on a phone,
        // so the strip is symmetric in both and never grows a stray limb.
        <BuzzLights
          remaining={turn.lightsRemaining}
          reducedMotion={reducedMotion}
          label={turn.lightsLabel}
          phase={turn.clockLabel}
          seconds={turn.clockSeconds}
          control={
            typing ? (
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", width: { xs: "100%", sm: 250 } }}>
                <MicAnswerField
                  label={finalOpen ? "Final answer" : "What is…"}
                  value={answerInput}
                  onChange={setAnswerInput}
                  onSubmit={handleSubmitAnswer}
                  disabled={iSubmitted}
                  size="small"
                  autoFocus
                />
                <Tooltip title={finalOpen ? "Lock in" : "Send"}>
                  <IconButton
                    aria-label={finalOpen ? "Lock in" : "Send"}
                    onClick={() => handleSubmitAnswer()}
                    disabled={!answerInput.trim() || iSubmitted}
                    sx={{
                      ...controls.keyPrimary,
                      width: 34,
                      height: 34,
                      flex: "0 0 auto",
                      borderRadius: "50%",
                      "&.Mui-disabled": controls.keyOff,
                    }}
                  >
                    <SendIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            ) : undefined
          }
        />
      ) : null}

      {wagerOpen ? (
        // The wager bench: the range printed on the housing, a readout to
        // type into, the key that places it, and two quick picks.
        <Housing sx={wrapHousingSx}>
          <HousingLabel sx={{ height: 32, pl: 1.25, pr: 1 }}>
            {isFinal ? "Final wager" : "Wager"} · ${turn.wagerLimits.min}–${turn.wagerLimits.max}
          </HousingLabel>
          <TextField
            type="number"
            value={wagerInput}
            onChange={(event) => setWagerInput(event.target.value)}
            placeholder="$"
            slotProps={{
              htmlInput: {
                min: turn.wagerLimits.min,
                max: turn.wagerLimits.max,
                "aria-label": "Wager",
              },
            }}
            size="small"
            autoFocus
            sx={{
              width: 104,
              "& .MuiInputBase-root": { height: 32 },
              // A readout has no spinner.
              "& input[type=number]": { MozAppearance: "textfield" },
              "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button": {
                WebkitAppearance: "none",
                margin: 0,
              },
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSubmitWager();
              }
            }}
          />
          <Button variant="contained" onClick={handleSubmitWager} sx={{ ...controls.keyPrimary, ...benchKeySx }}>
            Wager
          </Button>
          <HousingDivider sx={{ display: { xs: "none", sm: "block" } }} />
          {!isFinal ? (
            <Button size="small" variant="outlined" onClick={() => setWagerInput(String(clue.value))} sx={benchKeySx}>
              ${clue.value}
            </Button>
          ) : null}
          <Button
            size="small"
            variant="outlined"
            onClick={() => setWagerInput(String(turn.wagerLimits.max))}
            sx={benchKeySx}
          >
            {isFinal ? "Everything" : "True Daily Double"}
          </Button>
        </Housing>
      ) : null}

      {iSubmitted && !answerRevealed ? (
        <Typography variant="overline" sx={{ color: ui.inkMuted }}>
          Answer locked in
        </Typography>
      ) : null}

      {iAmHost && answerRevealed && clue.currentJudgePlayerId ? (
        <JudgeBench
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
export { PodiumClueButtons } from "./clue/PodiumClueButtons";
