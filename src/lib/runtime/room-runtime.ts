import type { GameEvent, PublicGameState } from "@/lib/game";
import type { ChatMessage, ClientGameCommand, RealtimeRejectReason } from "@/lib/realtime";

export type RoomConnectionStatus =
  | "local"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "rejected";

/**
 * Why a room is not live, in words a screen can branch on. `online.error`
 * carries the sentence to show; this is the thing to decide on.
 */
export type RoomProblem =
  /** The code names no open room. */
  | "not-found"
  /** The rooms service could not be reached (network, outage, timeout). */
  | "unreachable"
  /** Every seat is taken. */
  | "full"
  /** The host removed this player. */
  | "kicked"
  /** Another tab of this browser took the seat. */
  | "replaced"
  /** A new room's code was already in use (the client rolls another). */
  | "code-taken"
  /** The seat belongs to a different device. */
  | "invalid-session";

/** Maps the wire's rejection reason onto what the client cares about. */
export function problemFromRejection(reason: RealtimeRejectReason): RoomProblem {
  switch (reason) {
    case "room-not-found":
      return "not-found";
    case "room-full":
      return "full";
    case "kicked":
      return "kicked";
    case "room-code-taken":
      return "code-taken";
    default:
      return "invalid-session";
  }
}

export interface RoomRuntimeListeners {
  onPublicState: (state: PublicGameState) => void;
  onEvents: (events: GameEvent[]) => void;
  onChat: (message: ChatMessage) => void;
  onStatus?: (status: RoomConnectionStatus, detail?: string, problem?: RoomProblem) => void;
  /** The room let this client in and issued (or confirmed) its seat token. */
  onSession?: (sessionToken: string) => void;
  /** Something this client asked for was refused, addressed to it alone. */
  onRefused?: (reason: RealtimeRejectReason, message: string) => void;
}

/**
 * What the UI is allowed to know about the room it is playing in. Solo play
 * runs the room in the browser; a shared room runs it on the server. Both
 * expose the same surface so components never branch on transport.
 */
export interface RoomRuntime {
  readonly mode: "local" | "network";
  readonly roomId: string;
  /** The player id this client acts as. */
  readonly selfId: string;
  getPublicState(): PublicGameState | null;
  getChatHistory(): ChatMessage[];
  sendCommand(actorId: string, command: ClientGameCommand): void;
  postChat(authorId: string, authorName: string, text: string): void;
  /** Ask the room to score one queued answer with the fuzzy judge. */
  requestAiJudge(targetPlayerId: string): void;
  destroy(): void;
}
