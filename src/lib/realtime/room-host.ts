import { baselineBotProfiles, type BotProfile } from "@/lib/foundation/game-contracts";
import {
  createGame,
  type GameClue,
  type GameEvent,
  type GamePlayer,
  type GameSettings,
  type GameState,
} from "@/lib/game";
import { InMemoryRealtimeRoom } from "./in-memory-room";
import { RoomDirector } from "./room-director";

/**
 * Show-paced defaults. The engine itself stays timing-agnostic so unit tests
 * can drive it on a tight clock; these are the values a real game runs on.
 */
export const showTimings: Pick<
  GameSettings,
  | "buzzUnlockDelayMs"
  | "readoutPerCharMs"
  | "buzzWindowMs"
  | "answerTimeoutMs"
  | "finalTimeoutMs"
  | "earlyBuzzLockoutMs"
  | "autoAdvanceMs"
  | "roundIntroMs"
> = {
  // Baseline readout padding; the per-char term below carries most of the
  // timing so short clues don't wait forever.
  buzzUnlockDelayMs: 1_500,
  // 70ms/char ≈ 140 wpm — a comfortable host pace that lines up with the
  // TTS rate used for the readout.
  readoutPerCharMs: 70,
  buzzWindowMs: 6_000,
  answerTimeoutMs: 10_000,
  finalTimeoutMs: 30_000,
  // The show's quarter-second penalty for ringing in early.
  earlyBuzzLockoutMs: 250,
  autoAdvanceMs: 3_500,
  roundIntroMs: 2_600,
};

export interface RoomHostOptions {
  roomId: string;
  players?: GamePlayer[];
  clues?: GameClue[];
  settings?: Partial<GameSettings>;
  botProfiles?: Record<string, BotProfile>;
  seed?: number;
  /** How often time-driven transitions are evaluated. 0 disables the loop. */
  tickIntervalMs?: number;
  now?: () => number;
}

/**
 * A running room: authoritative state, the automation director, and the tick
 * loop that expires windows. Solo play constructs one in the browser; the
 * Socket.IO server constructs one per shared room.
 */
export class RoomHost {
  readonly roomId: string;
  readonly room: InMemoryRealtimeRoom;
  readonly director: RoomDirector;
  private tickTimer: ReturnType<typeof setInterval> | undefined;
  private readonly tickIntervalMs: number;
  private readonly now: () => number;
  private readonly unsubscribe: () => void;
  private destroyed = false;
  lastActivityAt: number;

  constructor(options: RoomHostOptions) {
    this.roomId = options.roomId;
    this.now = options.now ?? (() => Date.now());
    this.tickIntervalMs = options.tickIntervalMs ?? 250;
    this.lastActivityAt = this.now();

    const initialState = createGame({
      roomId: options.roomId,
      players: options.players ?? [],
      clues: options.clues ?? [],
      now: this.now(),
      settings: { ...showTimings, ...options.settings },
    });

    this.room = new InMemoryRealtimeRoom({
      initialState,
      clock: { now: this.now },
    });
    this.director = new RoomDirector(this.room, {
      seed: options.seed,
      botProfiles: options.botProfiles,
    });
    this.unsubscribe = this.room.onChange((state, events) => {
      this.lastActivityAt = this.now();
      this.narrate(state, events);
    });
  }

  start() {
    this.director.start();
    if (this.tickIntervalMs > 0 && !this.tickTimer) {
      this.tickTimer = setInterval(() => this.room.tick(this.now()), this.tickIntervalMs);
      // Never hold a Node process open just for an idle room.
      (this.tickTimer as unknown as { unref?: () => void }).unref?.();
    }
    return this;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribe();
    this.director.stop();
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = undefined;
  }

  get isDestroyed() {
    return this.destroyed;
  }

  getState(): GameState {
    return this.room.getState();
  }

  /** Seats a bot and registers its difficulty profile with the director. */
  addBot(input: { id: string; displayName: string; profileId?: string; emoji?: string; color?: string }) {
    const profile =
      baselineBotProfiles.find((candidate) => candidate.id === input.profileId) ??
      baselineBotProfiles[1];
    const hostId = this.room.getState().settings.hostId;
    this.room.dispatch(hostId ?? input.id, {
      type: "add-bot",
      bot: { id: input.id, displayName: input.displayName, emoji: input.emoji, color: input.color },
    });
    this.director.addBot(input.id, profile);
    return profile;
  }

  /** Narrates the board into room chat so late joiners can follow along. */
  private narrate(state: GameState, events: GameEvent[]) {
    for (const event of events) {
      switch (event.type) {
        case "clue-picked": {
          const clue = state.cluesById[event.clueId];
          const player = state.players[event.actorId];
          this.room.postChat({
            kind: "system",
            text: `${player?.displayName ?? event.actorId} → ${clue?.category ?? "?"} $${
              clue?.value ?? 0
            }${event.dailyDouble ? " · Daily Double" : ""}`,
          });
          break;
        }
        case "answer-judged": {
          const player = state.players[event.targetPlayerId];
          const name = player?.displayName ?? event.targetPlayerId;
          this.room.postChat({
            kind: "host",
            text:
              event.correct === true
                ? `${name} +$${event.delta}`
                : event.correct === false
                  ? `${name} $${event.delta}`
                  : `${name} —`,
          });
          break;
        }
        case "round-advanced":
          this.room.postChat({ kind: "system", text: roundLabel(event.round) });
          break;
        case "player-joined":
          if (!event.rejoined) {
            this.room.postChat({ kind: "system", text: `${event.displayName} joined` });
          }
          break;
        case "player-left": {
          this.room.postChat({ kind: "system", text: `A player left the room` });
          break;
        }
        case "buzz-window-closed":
          this.room.postChat({ kind: "host", text: "No takers." });
          break;
        case "command-rejected":
          // Rejections fire constantly during normal play (early buzzes,
          // queue ordering races). Only surface setup/auth problems.
          if (
            event.reason === "not-authorized" ||
            event.reason === "room-full" ||
            event.reason === "undo-unavailable"
          ) {
            this.room.postChat({ kind: "system", text: event.message });
          }
          break;
        default:
          break;
      }
    }
  }
}

function roundLabel(round: string): string {
  switch (round) {
    case "jeopardy":
      return "Jeopardy! round";
    case "double-jeopardy":
      return "Double Jeopardy! round";
    case "triple-jeopardy":
      return "Triple Jeopardy! round";
    case "final-jeopardy":
      return "Final Jeopardy!";
    case "complete":
      return "That's the game.";
    default:
      return round;
  }
}
