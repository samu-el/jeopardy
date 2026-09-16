"use client";

import { useEffect, useRef } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import type { PublicGameState } from "@/lib/game";
import { primeAudio, primeSpeech } from "@/lib/ai";
import { controls } from "@/lib/foundation/jeopardy-style";
import { useClueTurn } from "../use-clue-turn";
import { stackedButtonSx } from "./bench-style";

interface PodiumClueButtonsProps {
  state: PublicGameState;
  currentClientId: string;
}

/**
 * The buttons, on your own lectern.
 *
 * Stacked and one width, so BUZZ and Reveal read as a pair rather than two
 * shapes that happen to be next to each other, and so the thing you press
 * every clue is always in the same place — under your own score, not
 * floating in the middle of the screen.
 */
export function PodiumClueButtons({ state, currentClientId }: PodiumClueButtonsProps) {
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
    <Stack spacing={0.4} sx={{ pt: 0.5 }}>
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
            ...(canIBuzz ? controls.buzzer : controls.keyOff),
            fontSize: 13,
            letterSpacing: "0.12em",
            "&.Mui-disabled": controls.keyOff,
          }}
        >
          {turn.buzzedByMe ? "IN!" : turn.isLockedOut ? "LOCKED" : "BUZZ"}
        </Button>
      ) : null}

      {showReveal ? (
        <Button
          variant="outlined"
          onClick={() => send({ type: "reveal-answer" })}
          sx={{ ...stackedButtonSx, ...controls.key }}
        >
          Reveal
        </Button>
      ) : null}

      {showNext ? (
        <Button
          variant="contained"
          data-testid="next-clue"
          onClick={() => send({ type: "skip" })}
          sx={{ ...stackedButtonSx, ...controls.keyPrimary }}
        >
          Next clue
        </Button>
      ) : null}
    </Stack>
  );
}

