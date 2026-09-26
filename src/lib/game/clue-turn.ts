/**
 * What is true about the clue on screen, for one client, at one instant.
 *
 * Pure: the public state, who is asking, and a clock go in; the answer to
 * "can I buzz, whose answer is it, how long is left, what does the clock say"
 * comes out. The React hook in `components/use-clue-turn.ts` only ticks the
 * clock and remembers how long each window was when it first saw it.
 *
 * Nothing here is authority. The room still refuses a buzz it would not
 * take; this only stops a screen from offering one.
 */
import type { PublicActiveClueState, PublicGameState } from "./contracts";

/** How long a window ran in total, as first observed by the client. */
export interface ObservedWindows {
  /** Total length of the current ring-in window (useful after a rebound). */
  buzzMs?: number;
  /** Total length of the current answer window. */
  answerMs?: number;
}

export type CluePhase =
  | "none"
  | "wager"
  | "reading"
  | "ring-in"
  | "answering"
  | "final-answer"
  | "daily-double-answer"
  | "judging"
  | "ruled"
  | "timed-out";

export interface ClueTurnView {
  clue: PublicActiveClueState | undefined;
  now: number;
  iAmHost: boolean;
  isFinal: boolean;
  isDailyDouble: boolean;
  clueRevealed: boolean;
  answerRevealed: boolean;
  buzzedByMe: boolean;
  iSubmitted: boolean;
  isLockedOut: boolean;
  canIBuzz: boolean;
  canAdvance: boolean;
  myWagerOpen: boolean;
  wagerSubmittedByMe: boolean;
  wagerLimits: { min: number; max: number; maxIsScore: boolean };
  someoneBuzzed: boolean;
  inReadout: boolean;
  /** Whoever currently owns the answer (first buzzer / Daily Double player). */
  answeringPlayerId?: string;
  answeringPlayerName?: string;
  /** This client owes an answer right now and may type it. */
  mayAnswer: boolean;
  /** Final Jeopardy, and this client has no money to play it with. */
  spectatingFinal: boolean;
  phase: CluePhase;
  /** How much of whichever window is running is left, 0–1. Dark while reading. */
  lightsRemaining: number;
  lightsLabel: string;
  /** What the clock is timing, in words: "Reading…", "Ring in", "Sam rang in". */
  clockLabel: string;
  /** Whole seconds left on that window; null while nothing is counting down. */
  clockSeconds: number | null;
  /** Accessible value for the timer: "7 seconds left to answer". */
  clockValueText: string;
  /** Whole seconds until the finished clue closes by itself, or null. */
  autoAdvanceSeconds: number | null;
  /** Ends of the running windows, for the hook's window tracker. */
  windowEnds: { buzz?: number; answer?: number };
}

const houseMaximum = { "double-jeopardy": 2_000, "triple-jeopardy": 3_000 } as Record<string, number>;

/**
 * The limits for this player's wager: the room's own, when it sent them, and
 * otherwise the show's rule worked out from the score.
 */
export function wagerLimitsFor(
  clue: PublicActiveClueState | undefined,
  score: number,
  selfId?: string,
): { min: number; max: number; maxIsScore: boolean } {
  if (!clue) return { min: 0, max: 0, maxIsScore: false };
  const sent = selfId ? clue.wagerLimits?.[selfId] : undefined;
  if (sent) return sent;
  if (clue.round === "final-jeopardy") return { min: 0, max: Math.max(0, score), maxIsScore: true };
  const house = houseMaximum[clue.round] ?? 1_000;
  return { min: 5, max: Math.max(score, house), maxIsScore: score >= house };
}

/** A wager as typed, checked against the limits. Never clamps silently. */
export function validateWager(
  raw: string,
  limits: { min: number; max: number },
): { ok: true; amount: number } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: "Enter a wager." };
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    return { ok: false, message: "Wager whole dollars." };
  }
  if (amount < limits.min) return { ok: false, message: `Minimum wager is $${limits.min}.` };
  if (amount > limits.max) return { ok: false, message: `Maximum wager is $${limits.max}.` };
  return { ok: true, amount };
}

export function deriveClueTurn(
  state: PublicGameState,
  selfId: string,
  now: number,
  observed: ObservedWindows = {},
): ClueTurnView {
  const clue = state.currentClue;
  const myScore = state.players.find((player) => player.id === selfId)?.score ?? 0;
  const wagerLimits = wagerLimitsFor(clue, myScore, selfId);
  const iAmHost = state.settings.hostId === selfId;

  if (!clue) {
    return {
      clue: undefined,
      now,
      iAmHost,
      isFinal: false,
      isDailyDouble: false,
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
      mayAnswer: false,
      spectatingFinal: false,
      phase: "none",
      lightsRemaining: 0,
      lightsLabel: "",
      clockLabel: "",
      clockSeconds: null,
      clockValueText: "",
      autoAdvanceSeconds: null,
      windowEnds: {},
    };
  }

  const isFinal = clue.round === "final-jeopardy";
  const isDailyDouble = clue.kind ? clue.kind === "daily-double" : Boolean(clue.dailyDouble) && !isFinal;
  const clueRevealed = clue.clue !== undefined;
  // Answers are in once the room is judging or has settled the clue — even
  // while the response itself is withheld from the table for a rebound.
  const answerRevealed = clue.phase
    ? clue.phase === "judging" || clue.phase === "resolved"
    : clue.correctResponse !== undefined;
  const buzzedIds = Object.keys(clue.buzzes).sort(
    (a, b) => (clue.buzzes[a] ?? 0) - (clue.buzzes[b] ?? 0),
  );
  const someoneBuzzed = buzzedIds.length > 0;
  const buzzedByMe = clue.buzzes[selfId] !== undefined;
  const iSubmitted = Boolean(clue.submitted[selfId]);
  const isLockedOut = now < (clue.lockouts[selfId] ?? 0);
  const myWagerOpen = clue.waitingForWager.includes(selfId);
  const wagerSubmittedByMe =
    clue.wagers[selfId] !== undefined ||
    (!myWagerOpen && clue.waitingForWager.length === 0 && (isFinal || isDailyDouble));
  const wagering = clue.waitingForWager.length > 0;

  const readoutEndsAt = clue.readoutEndsAt ?? now;
  const inReadout = clueRevealed && now < readoutEndsAt;
  const buzzEndsAt = clue.buzzWindowEndsAt;
  const answerEndsAt = clue.answerWindowEndsAt;
  const wagerEndsAt = clue.wagerWindowEndsAt ?? now;
  const wagerWindowMs = Math.max(
    1,
    wagerEndsAt - (clue.wagerWindowStartsAt ?? wagerEndsAt - 20_000),
  );

  const answeringPlayerId = isDailyDouble
    ? clue.dailyDoublePlayerId
    : !isFinal
      ? buzzedIds[0]
      : undefined;
  const answeringPlayerName = answeringPlayerId ? nameOf(state, answeringPlayerId) : undefined;

  // Final Jeopardy is only for players who went in with money; the rest
  // watch. A finalist who bet it all and lost is still a finalist.
  const spectatingFinal =
    isFinal &&
    myScore <= 0 &&
    !myWagerOpen &&
    clue.buzzes[selfId] === undefined &&
    clue.judges[selfId] === undefined;

  const canIBuzz =
    !buzzedByMe &&
    !isLockedOut &&
    !isFinal &&
    !isDailyDouble &&
    !wagering &&
    clueRevealed &&
    !answerRevealed &&
    clue.judges[selfId] === undefined &&
    !inReadout &&
    buzzEndsAt !== undefined &&
    now <= buzzEndsAt &&
    !someoneBuzzed;

  const mayAnswer =
    clueRevealed &&
    !answerRevealed &&
    !wagering &&
    !iSubmitted &&
    buzzedByMe &&
    !spectatingFinal;

  const judged = Object.keys(clue.judges);
  const phase: CluePhase = wagering
    ? "wager"
    : !clueRevealed
      ? "wager"
      : answerRevealed
        ? clue.timedOut && judged.length === 0 && !someoneBuzzed
          ? "timed-out"
          : clue.currentJudgePlayerId
            ? "judging"
            : "ruled"
        : inReadout
          ? "reading"
          : isFinal
            ? "final-answer"
            : isDailyDouble
              ? "daily-double-answer"
              : someoneBuzzed
                ? "answering"
                : "ring-in";

  const answerTotal = Math.max(observed.answerMs ?? 0, isFinal ? 30_000 : 10_000);
  // A rebound window runs from when the buzzer re-opened, not from the
  // first readout; the room says when that was, or the client saw it.
  const buzzTotal = Math.max(
    1,
    buzzEndsAt === undefined
      ? 1
      : clue.reboundOpenedAt !== undefined
        ? buzzEndsAt - clue.reboundOpenedAt
        : (observed.buzzMs ?? buzzEndsAt - readoutEndsAt),
  );

  let lightsRemaining = 0;
  let clockSeconds: number | null = null;
  if (phase === "wager") {
    lightsRemaining = fraction(wagerEndsAt - now, wagerWindowMs);
    clockSeconds = wagering ? seconds(wagerEndsAt - now) : null;
  } else if (phase === "answering" || phase === "final-answer" || phase === "daily-double-answer") {
    const ends = answerEndsAt ?? now;
    lightsRemaining = fraction(ends - now, answerTotal);
    clockSeconds = answerEndsAt !== undefined ? seconds(ends - now) : null;
  } else if (phase === "ring-in") {
    const ends = buzzEndsAt ?? now;
    lightsRemaining = fraction(ends - now, buzzTotal);
    clockSeconds = buzzEndsAt !== undefined ? seconds(ends - now) : null;
  }

  const clockLabel = labelFor(phase, {
    answeringPlayerName,
    answeringIsMe: answeringPlayerId === selfId,
  });

  const lightsLabel =
    phase === "reading"
      ? "Reading the clue"
      : phase === "wager"
        ? "Time to wager"
        : phase === "ring-in"
          ? "Time to ring in"
          : "Answer time remaining";

  const clockValueText =
    clockSeconds === null
      ? phase === "reading"
        ? "Buzzers locked while the clue is read"
        : clockLabel
      : `${clockSeconds} ${clockSeconds === 1 ? "second" : "seconds"} left${
          phase === "ring-in"
            ? " to ring in"
            : phase === "wager"
              ? " to wager"
              : " to answer"
        }`;

  const autoAdvanceSeconds =
    clue.canAdvance && clue.closesAt !== undefined && clue.closesAt > now
      ? seconds(clue.closesAt - now)
      : null;

  return {
    clue,
    now,
    iAmHost,
    isFinal,
    isDailyDouble,
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
    answeringPlayerId,
    answeringPlayerName,
    mayAnswer,
    spectatingFinal,
    phase,
    lightsRemaining,
    lightsLabel,
    clockLabel,
    clockSeconds,
    clockValueText,
    autoAdvanceSeconds,
    windowEnds: { buzz: buzzEndsAt, answer: answerEndsAt },
  };
}

function labelFor(
  phase: CluePhase,
  who: { answeringPlayerName?: string; answeringIsMe: boolean },
): string {
  switch (phase) {
    case "wager":
      return "Wager closes";
    case "reading":
      return "Reading…";
    case "ring-in":
      return "Ring in";
    case "final-answer":
      return "Final answer";
    case "daily-double-answer":
      return who.answeringIsMe
        ? "Daily Double · your answer"
        : `Daily Double · ${who.answeringPlayerName ?? "answering"}`;
    case "answering":
      return who.answeringIsMe ? "You rang in" : `${who.answeringPlayerName} rang in`;
    case "timed-out":
      return "Time's up";
    case "judging":
      return "Judging";
    case "ruled":
      return "Ruled";
    default:
      return "";
  }
}

/**
 * Who pressed first, and who else pressed, in the order the room took them.
 * Players ruled wrong on this clue come first — they rang in earlier.
 */
export function buzzOrder(clue: PublicActiveClueState | undefined): string[] {
  if (!clue) return [];
  const wrong = Object.keys(clue.judges).filter((id) => clue.judges[id] === false);
  const live = Object.keys(clue.buzzes)
    .filter((id) => !wrong.includes(id))
    .sort((a, b) => (clue.buzzes[a] ?? 0) - (clue.buzzes[b] ?? 0));
  return clue.round === "final-jeopardy" || clue.dailyDouble ? [] : [...wrong, ...live];
}

/**
 * The lecterns in seat order: join order where the room knows it, and
 * otherwise the order this client first saw them. Never by score — a podium
 * that jumps sideways when a ruling lands is one nobody can find.
 */
export function seatOrder<T extends { id: string; joinedAt?: number }>(
  players: readonly T[],
  firstSeen: readonly string[] = [],
): T[] {
  const seen = (id: string) => {
    const index = firstSeen.indexOf(id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return [...players].sort(
    (a, b) =>
      (a.joinedAt ?? Number.MAX_SAFE_INTEGER) - (b.joinedAt ?? Number.MAX_SAFE_INTEGER) ||
      seen(a.id) - seen(b.id) ||
      a.id.localeCompare(b.id),
  );
}

/** The most recent ruling on the clue on screen, for the host's override. */
export function lastRuling(
  clue: PublicActiveClueState | undefined,
): { playerId: string; correct: boolean | null } | undefined {
  if (!clue) return undefined;
  const ids = Object.keys(clue.judges);
  const playerId = ids[ids.length - 1];
  if (!playerId) return undefined;
  return { playerId, correct: clue.judges[playerId] ?? null };
}

export function formatScore(score: number): string {
  return score < 0 ? `-$${Math.abs(score)}` : `$${score}`;
}

function fraction(remaining: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, remaining / total));
}

function seconds(remaining: number) {
  return Math.max(0, Math.ceil(remaining / 1000));
}

export function nameOf(state: PublicGameState, id: string) {
  return state.players.find((player) => player.id === id)?.displayName ?? id;
}
