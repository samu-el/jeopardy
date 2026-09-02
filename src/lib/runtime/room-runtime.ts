import type { GameEvent, PublicGameState } from "@/lib/game";
import type { ChatMessage, ClientGameCommand } from "@/lib/realtime";

export type RoomConnectionStatus =
  | "local"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "rejected";

export interface RoomRuntimeListeners {
  onPublicState: (state: PublicGameState) => void;
  onEvents: (events: GameEvent[]) => void;
  onChat: (message: ChatMessage) => void;
  onStatus?: (status: RoomConnectionStatus, detail?: string) => void;
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
