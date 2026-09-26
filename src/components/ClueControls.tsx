"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import SendIcon from "@mui/icons-material/SendOutlined";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { PublicGameState } from "@/lib/game";
import { nameOf, validateWager } from "@/lib/game/clue-turn";
import { useGameStore } from "@/lib/state/game-store";
import { controls, jeopardyPalette, ui } from "@/lib/foundation/jeopardy-style";
import { MicAnswerField } from "./MicAnswerField";
import { BuzzLights } from "./BuzzLights";
import { Housing, HousingDivider, HousingLabel } from "./Housing";
import { FinalReveal } from "./clue/FinalReveal";
import { JudgeBench } from "./clue/JudgeBench";
import { benchKeySx, wrapHousingSx } from "./clue/bench-style";
import { answerFocusProxyId, isTyping, keyBelongsToControl } from "./clue/keyboard";
import { useClueTurn } from "./use-clue-turn";
import { useReducedMotion } from "./use-reduced-motion";
import { visuallyHiddenSx } from "./visually-hidden";

interface ClueControlsProps {
  state: PublicGameState;
  currentClientId: string;
}

/** Send what is typed this long before the answer clock runs out. */
const submitBeforeTimeoutMs = 600;

/** Keyboard hints for an answer: send on Enter, and leave proper nouns alone. */
const answerInputHints = {
  enterKeyHint: "send",
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "none",
  spellCheck: false,
} as const;

/**
 * The clock and the things you type: the countdown, the answer, the wager,
 * and the host's judging.
 *
 * The buttons live on your lectern (`PodiumClueButtons`) — or, on a phone, in
 * the bar along the bottom. What is left here is what a lectern has no room
 * for: a progress bar, a text field, and a row about somebody else's answer.
 */
export function ClueControls({ state, currentClientId }: ClueControlsProps) {
  const reducedMotion = useReducedMotion();
  const shortcutsEnabled = useGameStore((s) => s.preferences.shortcutsEnabled !== false);
  const [answerInput, setAnswerInput] = useState("");
  const [wagerInput, setWagerInput] = useState("");
  const [wagerError, setWagerError] = useState<string | null>(null);
  const turn = useClueTurn(state, currentClientId);
  const { clue, send } = turn;
  const autoSubmitted = useRef<string | null>(null);
  const proxyRef = useRef<HTMLInputElement | null>(null);

  // A new clue clears whatever was half-typed for the last one.
  const activeClueId = clue?.clueId ?? null;
  const [trackedClueId, setTrackedClueId] = useState<string | null>(null);
  if (trackedClueId !== activeClueId) {
    setTrackedClueId(activeClueId);
    setAnswerInput("");
    setWagerInput("");
    setWagerError(null);
  }

  const { iAmHost, clueRevealed, answerRevealed, canAdvance } = turn;
  const judgeTarget = answerRevealed ? clue?.currentJudgePlayerId : undefined;

  // The shortcuts are registered here rather than in the hook, because the
  // hook runs in two components and a keystroke would fire twice.
  useEffect(() => {
    if (!clue) return;
    function handleKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      // Space rings in only when focus is on the game itself: the page, the
      // clue, the buzzer. A focused button, field or menu keeps its Space.
      if (event.code === "Space") {
        if (keyBelongsToControl(event.target) || answerRevealed) return;
        event.preventDefault();
        // An early press still goes to the room: ringing in before the
        // lights costs a lockout, and that is the room's call.
        if (!event.repeat) send({ type: "buzz" });
        return;
      }
      // Letters are letters in a field, and belong to a dialog inside one.
      // A focused button has no use for "y", so they still work there.
      if (!shortcutsEnabled || isTyping(event.target) || inOverlay(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "r" && !answerRevealed && clueRevealed && iAmHost) {
        event.preventDefault();
        send({ type: "reveal-answer" });
        return;
      }
      if (iAmHost && judgeTarget && (key === "y" || key === "n")) {
        event.preventDefault();
        send({ type: "judge-answer", targetPlayerId: judgeTarget, correct: key === "y" });
        return;
      }
      if (key === "s" && canAdvance && iAmHost) {
        event.preventDefault();
        send({ type: "skip" });
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [clue, send, iAmHost, canAdvance, judgeTarget, answerRevealed, clueRevealed, shortcutsEnabled]);

  const { isFinal, iSubmitted, myWagerOpen, wagerSubmittedByMe, mayAnswer, spectatingFinal } = turn;
  const typing = mayAnswer;

  // Whatever is typed when the clock runs out is sent, not thrown away.
  const answerEndsAt = clue?.answerWindowEndsAt;
  const pendingText = answerInput.trim();
  useEffect(() => {
    if (!typing || !pendingText || answerEndsAt === undefined) return;
    const key = `${activeClueId}:${answerEndsAt}`;
    if (autoSubmitted.current === key) return;
    const delay = Math.max(0, answerEndsAt - Date.now() - submitBeforeTimeoutMs);
    const id = setTimeout(() => {
      autoSubmitted.current = key;
      send({ type: "submit-answer", answer: pendingText });
    }, delay);
    return () => clearTimeout(id);
  }, [typing, pendingText, answerEndsAt, activeClueId, send]);

  // The stand-in focused by a touch buzz lets go if the buzz went elsewhere.
  useEffect(() => {
    if (turn.buzzedByMe || !turn.someoneBuzzed) return;
    if (document.activeElement === proxyRef.current) proxyRef.current?.blur();
  }, [turn.buzzedByMe, turn.someoneBuzzed]);

  useKeepClueAboveKeyboard(typing);

  if (!clue) return null;

  function handleSubmitAnswer(dictated?: string) {
    const text = (dictated ?? answerInput).trim();
    if (!text) return;
    send({ type: "submit-answer", answer: text });
    setAnswerInput("");
  }

  function handleSubmitWager() {
    const checked = validateWager(wagerInput, turn.wagerLimits);
    if (!checked.ok) {
      setWagerError(checked.message);
      return;
    }
    setWagerError(null);
    send({ type: "submit-wager", amount: checked.amount });
  }

  const wagerOpen = myWagerOpen && !wagerSubmittedByMe && !spectatingFinal;
  const finalOpen = isFinal && typing;
  const othersDailyDouble =
    turn.isDailyDouble && clueRevealed && !answerRevealed && !mayAnswer && turn.answeringPlayerName;
  const timesUp = turn.phase === "timed-out";

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
      {/* Focused inside a touch buzz so iOS opens its keyboard in the tap;
          focus moves on to the real field when it mounts. */}
      <Box
        component="input"
        ref={proxyRef}
        id={answerFocusProxyId}
        aria-hidden
        tabIndex={-1}
        readOnly
        {...{ autoComplete: "off", autoCorrect: "off", autoCapitalize: "none" }}
        sx={{ ...visuallyHiddenSx, fontSize: 16, opacity: 0 }}
      />

      {!answerRevealed ? (
        // One instrument: the lamps, the countdown and — while the clock is
        // yours — the answer field share a housing.
        <BuzzLights
          remaining={turn.lightsRemaining}
          reducedMotion={reducedMotion}
          label={turn.lightsLabel}
          valueText={turn.clockValueText}
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
                  htmlInputProps={answerInputHints}
                />
                <Tooltip title={finalOpen ? "Lock in" : "Send"}>
                  <IconButton
                    aria-label={finalOpen ? "Lock in answer" : "Send answer"}
                    onClick={() => handleSubmitAnswer()}
                    disabled={!answerInput.trim() || iSubmitted}
                    sx={{
                      ...controls.keyPrimary,
                      width: 40,
                      height: 40,
                      flex: "0 0 auto",
                      borderRadius: "50%",
                      "&.Mui-disabled": controls.keyOff,
                      "@media (pointer: coarse)": { width: 44, height: 44 },
                    }}
                  >
                    <SendIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            ) : undefined
          }
        />
      ) : null}

      {othersDailyDouble ? (
        <Typography variant="overline" sx={{ color: ui.inkMuted }} data-testid="dd-answering">
          {turn.answeringPlayerName} is answering
        </Typography>
      ) : null}

      {spectatingFinal ? (
        <Typography
          variant="body2"
          data-testid="final-spectating"
          sx={{ color: ui.inkMuted, textAlign: "center", maxWidth: 420 }}
        >
          Final Jeopardy is for players above $0 — you&rsquo;re watching this one.
        </Typography>
      ) : null}

      {wagerOpen ? (
        // The wager bench: the range printed on the housing, a readout to
        // type into, the key that places it, and two quick picks.
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, maxWidth: "100%" }}>
          <Housing sx={wrapHousingSx}>
            <HousingLabel sx={{ height: 32, pl: 1.25, pr: 1 }}>
              {isFinal ? "Final wager" : "Wager"} · ${turn.wagerLimits.min}–${turn.wagerLimits.max}
            </HousingLabel>
            <TextField
              type="number"
              value={wagerInput}
              onChange={(event) => {
                setWagerInput(event.target.value);
                setWagerError(null);
              }}
              placeholder="$"
              error={Boolean(wagerError)}
              slotProps={{
                htmlInput: {
                  min: turn.wagerLimits.min,
                  max: turn.wagerLimits.max,
                  inputMode: "numeric",
                  enterKeyHint: "done",
                  "aria-label": "Wager",
                  "aria-invalid": Boolean(wagerError),
                  "aria-describedby": wagerError ? "wager-error" : undefined,
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
              {isFinal
                ? "Everything"
                : turn.wagerLimits.maxIsScore
                  ? "True Daily Double"
                  : `Max $${turn.wagerLimits.max}`}
            </Button>
          </Housing>
          {wagerError ? (
            <Typography
              id="wager-error"
              role="alert"
              variant="caption"
              sx={{ color: "#FF8A93", fontWeight: 600 }}
            >
              {wagerError}
            </Typography>
          ) : null}
        </Box>
      ) : null}

      {iSubmitted && !answerRevealed && !spectatingFinal ? (
        <Typography variant="overline" sx={{ color: ui.inkMuted }} role="status">
          Answer locked in
        </Typography>
      ) : null}

      {turn.phase === "judging" && !iAmHost && clue.currentJudgePlayerId ? (
        <Typography variant="overline" sx={{ color: ui.inkMuted }} data-testid="judging">
          Judging {nameOf(state, clue.currentJudgePlayerId)}
        </Typography>
      ) : null}

      {timesUp ? (
        <Typography
          variant="overline"
          data-testid="times-up"
          sx={{ color: jeopardyPalette.goldBright, fontWeight: 700, letterSpacing: "0.14em" }}
        >
          Time&rsquo;s up
        </Typography>
      ) : null}

      {turn.autoAdvanceSeconds !== null && !iAmHost ? (
        <Typography variant="caption" sx={{ color: ui.inkMuted }} data-testid="auto-advance">
          Next clue in {turn.autoAdvanceSeconds}s
        </Typography>
      ) : null}

      {isFinal ? <FinalReveal state={state} /> : null}

      {iAmHost ? <JudgeBench state={state} send={send} /> : null}
    </Box>
  );
}

function inOverlay(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest('[role="dialog"], .MuiPopover-root, .MuiModal-root'))
  );
}

/**
 * While you type an answer on a phone, the on-screen keyboard takes half the
 * screen. Keep the clue and the field in what is left: scroll the board to
 * the top of the visible area, and tell the page how tall that area is.
 */
function useKeepClueAboveKeyboard(active: boolean) {
  useEffect(() => {
    if (!active || typeof window === "undefined" || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const root = document.documentElement;
    function sync() {
      const keyboardOpen = viewport.height < window.innerHeight - 120;
      if (keyboardOpen) {
        root.style.setProperty("--keyboard-viewport-height", `${Math.round(viewport.height)}px`);
        root.dataset.keyboardOpen = "true";
        document
          .querySelector('[data-testid="board"]')
          ?.scrollIntoView({ block: "start", behavior: "auto" });
      } else {
        root.style.removeProperty("--keyboard-viewport-height");
        delete root.dataset.keyboardOpen;
      }
    }
    viewport.addEventListener("resize", sync);
    sync();
    return () => {
      viewport.removeEventListener("resize", sync);
      root.style.removeProperty("--keyboard-viewport-height");
      delete root.dataset.keyboardOpen;
    };
  }, [active]);
}
export { PodiumClueButtons } from "./clue/PodiumClueButtons";
