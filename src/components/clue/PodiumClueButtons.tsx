"use client";

import { useEffect, useRef, useState, type PointerEvent, type MouseEvent } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import type { PublicGameState } from "@/lib/game";
import { nameOf } from "@/lib/game/clue-turn";
import { primeAudio, primeSpeech } from "@/lib/ai";
import { controls, jeopardyFonts, ui } from "@/lib/foundation/jeopardy-style";
import { useClueTurn } from "../use-clue-turn";
import { answerFocusProxyId, mayTakeFocus } from "./keyboard";
import { barButtonSx, stackedButtonSx } from "./bench-style";

interface PodiumClueButtonsProps {
  state: PublicGameState;
  currentClientId: string;
  /**
   * "podium": stacked inside your own lectern, on a desk.
   * "bar": a full-width bar pinned to the bottom of a phone screen, in the
   * thumb's reach whatever order the lecterns are in.
   */
  variant?: "podium" | "bar";
}

/**
 * The buttons you press: BUZZ, and the host's Reveal and Next.
 *
 * The buzzer rings in on pointer-down, not on release, so a tap is timed
 * when the finger lands — the same moment a keyboard player's Space is.
 */
export function PodiumClueButtons({
  state,
  currentClientId,
  variant = "podium",
}: PodiumClueButtonsProps) {
  const turn = useClueTurn(state, currentClientId);
  const buzzerRef = useRef<HTMLButtonElement | null>(null);
  const { clue, send, canIBuzz } = turn;
  const [attempt, setAttempt] = useState<{ clueId: string; at: number } | null>(null);

  // Take focus when the buzzer opens — unless you are busy elsewhere (typing
  // in chat, in a settings panel). Driven by the client's own view of the
  // clock: the snapshot's `canBuzz` was worked out before the readout ended.
  useEffect(() => {
    if (canIBuzz && mayTakeFocus()) buzzerRef.current?.focus({ preventScroll: true });
  }, [canIBuzz]);

  if (!clue) return null;

  const { iAmHost, isFinal, clueRevealed, answerRevealed, isDailyDouble } = turn;
  const showBuzzer = !isFinal && clueRevealed && !answerRevealed && !isDailyDouble;
  const showReveal = iAmHost && clueRevealed && !answerRevealed;
  const showNext = iAmHost && turn.canAdvance;

  // Somebody else's buzz landed while yours was in flight.
  const beaten =
    attempt?.clueId === clue.clueId &&
    !turn.buzzedByMe &&
    turn.answeringPlayerId !== undefined &&
    turn.answeringPlayerId !== currentClientId &&
    !isDailyDouble &&
    !isFinal
      ? nameOf(state, turn.answeringPlayerId)
      : null;

  if (!showBuzzer && !showReveal && !showNext) return null;

  function buzz(touch: boolean) {
    if (!clue) return;
    primeAudio();
    primeSpeech();
    if (touch) {
      // iOS only opens its keyboard for a field focused inside the tap. The
      // real answer field mounts once the room has taken the buzz, so focus
      // a stand-in now; focus moves from it to the real field, and the
      // keyboard stays up.
      document.getElementById(answerFocusProxyId)?.focus({ preventScroll: true });
    }
    setAttempt({ clueId: clue.clueId, at: Date.now() });
    send({ type: "buzz" });
  }

  const bar = variant === "bar";
  const keySx = bar ? barButtonSx : stackedButtonSx;

  const buzzer = showBuzzer ? (
    <Button
      ref={buzzerRef}
      data-buzzer="true"
      onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
        if (!event.isPrimary || event.button !== 0 || !canIBuzz) return;
        event.preventDefault();
        buzz(event.pointerType === "touch");
      }}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        // Pointer presses were taken on the way down; this is the keyboard.
        if (event.detail === 0 && canIBuzz) buzz(false);
      }}
      onContextMenu={(event) => event.preventDefault()}
      disabled={!canIBuzz}
      variant="contained"
      data-testid="buzzer"
      aria-label={
        turn.buzzedByMe ? "Buzzed in" : turn.isLockedOut ? "Buzzer locked" : "Buzz in"
      }
      sx={{
        ...keySx,
        ...(canIBuzz ? controls.buzzer : controls.keyOff),
        ...(bar ? { flex: "1 1 auto", fontSize: 22 } : { fontSize: 13 }),
        letterSpacing: "0.12em",
        "&.Mui-disabled": {
          ...controls.keyOff,
          // The disabled label carries information (IN!, LOCKED), so it
          // keeps readable contrast.
          color: ui.inkMuted,
        },
      }}
    >
      {turn.buzzedByMe ? "IN!" : turn.isLockedOut ? "LOCKED" : "BUZZ"}
    </Button>
  ) : null;

  const reveal = showReveal ? (
    <Button
      variant="outlined"
      onClick={() => send({ type: "reveal-answer" })}
      sx={{ ...keySx, ...controls.key, ...(bar ? { flex: "0 0 auto", px: 2 } : null) }}
    >
      Reveal
    </Button>
  ) : null;

  const next = showNext ? (
    <Button
      variant="contained"
      data-testid="next-clue"
      onClick={() => send({ type: "skip" })}
      sx={{ ...keySx, ...controls.keyPrimary, ...(bar ? { flex: "1 1 auto", px: 2 } : null) }}
    >
      Next clue
      {turn.autoAdvanceSeconds !== null ? (
        <Box component="span" sx={{ ml: 0.75, opacity: 0.8, fontVariantNumeric: "tabular-nums" }}>
          · {turn.autoAdvanceSeconds}s
        </Box>
      ) : null}
    </Button>
  ) : null;

  const lost = beaten ? (
    <Box
      role="status"
      sx={{
        fontFamily: jeopardyFonts.display,
        fontSize: bar ? 12 : 10,
        letterSpacing: "0.06em",
        color: ui.inkMuted,
        textAlign: "center",
        textTransform: "uppercase",
      }}
    >
      {beaten} was first
    </Box>
  ) : null;

  if (bar) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, width: "100%" }}>
        {lost}
        <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
          {buzzer}
          {reveal}
          {next}
        </Stack>
      </Box>
    );
  }

  return (
    <Stack spacing={0.5} sx={{ pt: 0.5 }}>
      {buzzer}
      {reveal}
      {next}
      {lost}
    </Stack>
  );
}
