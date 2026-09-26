"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicGameState } from "@/lib/game";
import { deriveClueTurn, type ClueTurnView, type ObservedWindows } from "@/lib/game/clue-turn";
import type { ClientGameCommand } from "@/lib/realtime";
import { useGameStore } from "@/lib/state/game-store";

export interface ClueTurn extends ClueTurnView {
  send: (command: ClientGameCommand) => void;
}

/**
 * What is true about the clue on screen, for you, right now.
 *
 * The working-out is `deriveClueTurn`, a pure function with its own tests.
 * This hook only supplies a ticking clock and remembers how long each
 * window was when it first appeared — a rebound buzz window is shorter than
 * the stretch since the readout ended, and the public state doesn't say.
 */
export function useClueTurn(state: PublicGameState, currentClientId: string): ClueTurn {
  const runtime = useGameStore((s) => s.runtime);
  const [now, setNow] = useState(() => (typeof window === "undefined" ? 0 : Date.now()));

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const [tracked, setTracked] = useState<{
    buzzEnd?: number;
    buzzMs?: number;
    answerEnd?: number;
    answerMs?: number;
  }>({});
  const clue = state.currentClue;
  const buzzEnd = clue?.buzzWindowEndsAt;
  const answerEnd = clue?.answerWindowEndsAt;
  if (
    (buzzEnd !== undefined && tracked.buzzEnd !== buzzEnd) ||
    (answerEnd !== undefined && tracked.answerEnd !== answerEnd)
  ) {
    // First sight of a window: it runs from now (or from the end of the
    // readout, if that is still to come) to its end.
    setTracked((previous) => ({
      buzzEnd,
      buzzMs:
        buzzEnd === undefined
          ? undefined
          : previous.buzzEnd === buzzEnd
            ? previous.buzzMs
            : Math.max(1, buzzEnd - Math.max(now, clue?.readoutEndsAt ?? now)),
      answerEnd,
      answerMs:
        answerEnd === undefined
          ? undefined
          : previous.answerEnd === answerEnd
            ? previous.answerMs
            : Math.max(1, answerEnd - now),
    }));
  }
  const observed: ObservedWindows = {
    // The first ring-in window is measured exactly from the readout; only a
    // rebound needs the observed length.
    buzzMs:
      clue && Object.values(clue.judges).some((verdict) => verdict === false)
        ? tracked.buzzMs
        : undefined,
    answerMs: tracked.answerMs,
  };

  const send = useMemo(
    () => (command: ClientGameCommand) => runtime?.sendCommand(currentClientId, command),
    [runtime, currentClientId],
  );

  return { ...deriveClueTurn(state, currentClientId, now, observed), send };
}
