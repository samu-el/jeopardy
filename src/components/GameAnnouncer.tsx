"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import type { PublicGameState } from "@/lib/game";
import { announce, type AnnouncerFrame } from "@/lib/game/announcer";
import { useClueTurn } from "./use-clue-turn";
import { visuallyHiddenSx } from "./visually-hidden";

interface GameAnnouncerProps {
  state: PublicGameState;
  selfId: string;
}

/**
 * The game, read aloud to a screen reader.
 *
 * One live region, mounted for as long as the game is, so a screen reader
 * has it registered before anything is said into it — a status box that
 * mounts already holding its text is often never read. What to say is
 * worked out by `announce`, from what changed.
 */
export function GameAnnouncer({ state, selfId }: GameAnnouncerProps) {
  const turn = useClueTurn(state, selfId);
  const previous = useRef<AnnouncerFrame>({ state: null, phase: "none" });
  const warned = useRef<string | null>(null);
  const [message, setMessage] = useState("");
  const toggle = useRef(false);

  const phase = turn.phase;
  const secondsLeft = turn.clockSeconds;
  const mine = turn.mayAnswer;
  const clueId = state.currentClue?.clueId;
  const answerEndsAt = state.currentClue?.answerWindowEndsAt;

  useEffect(() => {
    const next: AnnouncerFrame = { state, phase };
    const lines = previous.current.state ? announce(previous.current, next, selfId) : [];
    previous.current = next;

    const warnKey = `${clueId}:${answerEndsAt}`;
    if (mine && secondsLeft === 5 && warned.current !== warnKey) {
      warned.current = warnKey;
      lines.push("5 seconds left.");
    }
    if (lines.length === 0) return;
    // A trailing no-break space flips on repeats, so the same sentence twice
    // in a row is still a change the screen reader hears.
    toggle.current = !toggle.current;
    setMessage(lines.join(" ") + (toggle.current ? " " : ""));
  }, [state, phase, selfId, mine, secondsLeft, clueId, answerEndsAt]);

  return (
    <Box role="status" aria-live="polite" aria-atomic="true" data-testid="game-announcer" sx={visuallyHiddenSx}>
      {message}
    </Box>
  );
}
