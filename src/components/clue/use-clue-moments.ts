"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicGameState } from "@/lib/game";
import { playSfx, startFinalTheme, stopFinalTheme } from "@/lib/ai";

/**
 * The two signature moments of a clue — the Daily Double sting and the
 * Final Jeopardy think music — as hooks any clue surface can run.
 *
 * The television draws its own clue (`TvClue`), and the television is the
 * screen with the speakers, so these cannot live only inside `ClueStage`.
 */

/** Flashes the splash once per Daily Double, while its wager is open. */
export function useDailyDoubleSplash(state: PublicGameState, soundEnabled: boolean): boolean {
  const clue = state.currentClue;
  const [splashedClueId, setSplashedClueId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  if (clue?.dailyDouble && clue.waitingForWager.length !== 0 && splashedClueId !== clue.clueId) {
    setSplashedClueId(clue.clueId);
    setVisible(true);
    if (soundEnabled) playSfx("daily-double");
  }

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => setVisible(false), 1_600);
    return () => clearTimeout(id);
  }, [visible]);

  return visible;
}

/** The Final Jeopardy think music: runs while the clue is live, stops on reveal. */
export function useFinalTheme(state: PublicGameState, soundEnabled: boolean) {
  const clue = state.currentClue;
  const armedFor = useRef<string | null>(null);
  const live =
    clue !== undefined &&
    clue.round === "final-jeopardy" &&
    clue.clue !== undefined &&
    clue.correctResponse === undefined &&
    soundEnabled;

  useEffect(() => {
    if (!live) {
      // Muting mid-think stops it too, not only the reveal.
      stopFinalTheme();
      armedFor.current = null;
      return;
    }
    if (armedFor.current === clue.clueId) return;
    armedFor.current = clue.clueId;
    startFinalTheme(30);
  }, [clue, live]);

  useEffect(() => () => stopFinalTheme(), []);
}

/**
 * A ticking countdown to a room deadline, in whole seconds. Room clocks and
 * browser clocks are both network-synced, which is close enough for a
 * number a room reads off a television.
 */
export function useCountdown(deadline: number | undefined): number | null {
  const [now, setNow] = useState(() => (typeof window === "undefined" ? 0 : Date.now()));

  useEffect(() => {
    if (deadline === undefined) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);

  if (deadline === undefined || now === 0) return null;
  return Math.max(0, Math.ceil((deadline - now) / 1_000));
}
