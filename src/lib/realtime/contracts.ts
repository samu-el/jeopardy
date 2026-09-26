import type {
  GameCommand,
  GameEvent,
  PublicGameState,
} from "@/lib/game";
import type { ChatMessage } from "./chat";

export type RealtimeConnectionStatus =
  | "connected"
  | "replaced"
  | "disconnected";

export type RealtimeRejectReason =
  | "invalid-session"
  | "unknown-connection"
  | "unknown-message"
  | "invalid-command"
  /** The code names no room anyone has opened. */
  | "room-not-found"
  /** Every seat is taken (bots and spectators count). */
  | "room-full"
  /** A create request landed on a code somebody else already holds. */
  | "room-code-taken"
  /** The host removed this player; they may not come straight back. */
  | "kicked"
  /** Host-only: the sender does not hold the chair. */
  | "not-authorized";

/**
 * Rejections the client cannot recover from by reconnecting on its own. A
 * socket that hears one of these stops retrying and waits for the person.
 */
export const terminalRejectReasons: readonly RealtimeRejectReason[] = [
  "invalid-session",
  "room-not-found",
  "room-full",
  "room-code-taken",
  "kicked",
];

export function isTerminalRejectReason(reason: RealtimeRejectReason): boolean {
  return terminalRejectReasons.includes(reason);
}

/** How long a removed player is kept out of the room they were removed from. */
export const kickBanMs = 5 * 60_000;

/**
 * How long a host who dropped off keeps their claim on the chair. Someone
 * else runs the board in the meantime; a host back inside the window gets it
 * handed straight back.
 */
export const hostReclaimGraceMs = 5 * 60_000;

export interface RealtimeSession {
  clientId: string;
  sessionToken: string;
}

export interface RealtimeConnectionRequest extends RealtimeSession {
  connectionId: string;
}

export interface RealtimeConnectionRecord extends RealtimeConnectionRequest {
  connectedAt: number;
  status: RealtimeConnectionStatus;
}

/**
 * What a client may ask the room to do: every engine command except `tick`,
 * with the actor stripped off.
 *
 * Derived rather than restated. The two used to be written out side by side,
 * ninety lines apart, and a command added to one of them was a command the
 * other silently refused.
 */
type WithoutActor<T> = T extends unknown ? Omit<T, "actorId"> : never;

export type ClientGameCommand = WithoutActor<Exclude<GameCommand, { type: "tick" }>>;

export type ClientRealtimeMessage =
  | {
      type: "game-command";
      commandId: string;
      command: ClientGameCommand;
    }
  | {
      type: "chat";
      commandId?: string;
      text: string;
    }
  | {
      /** Ask the room to run the fuzzy judge on one queued answer. */
      type: "ai-judge";
      commandId?: string;
      targetPlayerId: string;
    };

export type ServerRealtimeMessage =
  | {
      type: "session-accepted";
      connectionId: string;
      clientId: string;
      sessionToken: string;
      state: PublicGameState;
      chat: ChatMessage[];
    }
  | {
      type: "session-rejected";
      connectionId: string;
      clientId: string;
      reason: RealtimeRejectReason;
      message: string;
    }
  | {
      type: "connection-status";
      clientId: string;
      connectionId: string;
      status: RealtimeConnectionStatus;
    }
  | {
      type: "game-events";
      commandId?: string;
      events: GameEvent[];
    }
  | {
      type: "public-state";
      state: PublicGameState;
    }
  | {
      type: "chat";
      message: ChatMessage;
    }
  | {
      type: "message-rejected";
      commandId?: string;
      connectionId?: string;
      reason: RealtimeRejectReason;
      message: string;
    };

export type RealtimeMessageSink = (message: ServerRealtimeMessage) => void;

export interface RealtimeClock {
  now: () => number;
}

export interface RealtimeTokenFactory {
  createToken: (clientId: string) => string;
}

export interface RealtimeConnectResult {
  ok: boolean;
  reason?: RealtimeRejectReason;
}

/**
 * Stamps the session's own id onto a command from the wire.
 *
 * `actorId` is written last on purpose: whatever a client claims to be, the
 * room decides who it is speaking as.
 */
export function commandFromClient(
  clientId: string,
  command: ClientGameCommand,
): GameCommand {
  return { ...command, actorId: clientId } as GameCommand;
}
