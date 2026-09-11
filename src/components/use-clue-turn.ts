"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicActiveClueState, PublicGameState } from "@/lib/game";
import type { ClientGameCommand } from "@/lib/realtime";
import { useGameStore } from "@/lib/state/game-store";

export interface ClueTurn {
  clue: PublicActiveClueState | undefined;
  now: number;
  iAmHost: boolean;
  isFinal: boolean;
  clueRevealed: boolean;
  answerRevealed: boolean;
  buzzedByMe: boolean;
  iSubmitted: boolean;
  isLockedOut: boolean;
  canIBuzz: boolean;
  canAdvance: boolean;
  myWagerOpen: boolean;
  wagerSubmittedByMe: boolean;
  wagerLimits: { min: number; max: number };
  someoneBuzzed: boolean;
  inReadout: boolean;
  /** How much of whichever window is running is left, 0–1. */
  lightsRemaining: number;
  lightsLabel: string;
  /** What the clock is timing, in words: "Reading…", "Ring in", "Sam rang in". */
  clockLabel: string;
  /** Whole seconds left on that window; null while nothing is counting down. */
  clockSeconds: number | null;
  send: (command: ClientGameCommand) => void;
}

/**
 * What is true about the clue on screen, for you, right now.
 *
 * The clue's controls are drawn in two places — the strip under the board and
 * the buttons on your own lectern — and both need the same answer to "can I
 * buzz, has it been revealed, how long is left". Working it out twice is how
 * the two drift apart, so it is worked out here.
 */
export function useClueTurn(state: PublicGameState, currentClientId: string): ClueTurn {
  const runtime = useGameStore((s) => s.runtime);
  const [now, setNow] = useState(() => (typeof window === "undefined" ? 0 : Date.now()));
  const clue = state.currentClue;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const myScore =
    state.players.find((player) => player.id === currentClientId)?.score ?? 0;
  const wagerLimits = useMemo(() => {
    if (!clue) return { min: 0, max: 0 };
    if (clue.round === "final-jeopardy") return { min: 0, max: Math.max(0, myScore) };
    return {
      min: 5,
      max: Math.max(
        myScore,
        clue.round === "double-jeopardy"
          ? 2_000
          : clue.round === "triple-jeopardy"
            ? 3_000
            : 1_000,
      ),
    };
  }, [clue, myScore]);

  const send = useMemo(
    () => (command: ClientGameCommand) => runtime?.sendCommand(currentClientId, command),
    [runtime, currentClientId],
  );

  const iAmHost = state.settings.hostId === currentClientId;
  const isFinal = clue?.round === "final-jeopardy";
  const clueRevealed = clue?.clue !== undefined;
  const answerRevealed = clue?.correctResponse !== undefined;

  if (!clue) {
    return {
      clue: undefined,
      now,
      iAmHost,
      isFinal: false,
      clueRevealed: false,
      answerRevealed: false,
      buzzedByMe: false,
      iSubmitted: false,
      isLockedOut: false,
      canIBuzz: false,
      canAdvance: false,
      myWagerOpen: false,
      wagerSubmittedByMe: false,
      wagerLimits,
      someoneBuzzed: false,
      inReadout: false,
      lightsRemaining: 0,
      lightsLabel: "",
      clockLabel: "",
      clockSeconds: null,
      send,
    };
  }

  const buzzedIds = Object.keys(clue.buzzes);
  const someoneBuzzed = buzzedIds.length > 0;
  const buzzedByMe = clue.buzzes[currentClientId] !== undefined;
  const iSubmitted = Boolean(clue.submitted[currentClientId]);
  const isLockedOut = now < (clue.lockouts[currentClientId] ?? 0);
  const myWagerOpen = clue.waitingForWager.includes(currentClientId);
  const wagerSubmittedByMe =
    clue.wagers[currentClientId] !== undefined ||
    (!myWagerOpen &&
      clue.waitingForWager.length === 0 &&
      (isFinal || clue.dailyDouble));

  const readoutEndsAt = clue.readoutEndsAt ?? now;
  const buzzWindowEndsAt = clue.buzzWindowEndsAt ?? now;
  const answerEndsAt = clue.answerWindowEndsAt ?? now;
  const wagerEndsAt = clue.wagerWindowEndsAt ?? now;
  const wagerWindowMs = Math.max(
    1,
    wagerEndsAt - (clue.wagerWindowStartsAt ?? wagerEndsAt - 20_000),
  );
  const inReadout = now < readoutEndsAt;

  const canIBuzz =
    !buzzedByMe &&
    !isLockedOut &&
    !isFinal &&
    !clue.dailyDouble &&
    clue.waitingForWager.length === 0 &&
    clueRevealed &&
    !answerRevealed &&
    clue.judges[currentClientId] === undefined &&
    !inReadout &&
    now <= buzzWindowEndsAt &&
    !someoneBuzzed;

  const lightsRemaining = clue.waitingForWager.length
    ? fraction(wagerEndsAt - now, wagerWindowMs)
    : someoneBuzzed || isFinal || clue.dailyDouble
      ? fraction(answerEndsAt - now, isFinal ? 30_000 : 10_000)
      : inReadout
        ? 1
        : fraction(buzzWindowEndsAt - now, Math.max(1, buzzWindowEndsAt - readoutEndsAt));

  const firstBuzzer = someoneBuzzed
    ? playerName(
        state,
        buzzedIds.sort((a, b) => (clue.buzzes[a] ?? 0) - (clue.buzzes[b] ?? 0))[0],
      )
    : null;

  return {
    clue,
    now,
    iAmHost,
    isFinal,
    clueRevealed,
    answerRevealed,
    buzzedByMe,
    iSubmitted,
    isLockedOut,
    canIBuzz,
    canAdvance: Boolean(clue.canAdvance),
    myWagerOpen,
    wagerSubmittedByMe,
    wagerLimits,
    someoneBuzzed,
    inReadout,
    lightsRemaining,
    lightsLabel: inReadout
      ? "Reading the clue"
      : someoneBuzzed
        ? "Answer time remaining"
        : "Time to ring in",
    clockLabel: clue.waitingForWager.length
      ? "Wager closes"
      : inReadout
        ? "Reading…"
        : someoneBuzzed
          ? `${firstBuzzer} rang in`
          : "Ring in",
    clockSeconds: clue.waitingForWager.length
      ? seconds(wagerEndsAt - now)
      : inReadout
        ? null
        : someoneBuzzed
          ? seconds(answerEndsAt - now)
          : seconds(buzzWindowEndsAt - now),
    send,
  };
}

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
