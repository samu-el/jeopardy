import type { PublicGameState } from "@/lib/game";
import type { ChatMessage, ClientGameCommand } from "@/lib/realtime";
import type { RoomRuntime, RoomRuntimeListeners } from "./room-runtime";
import { SocketClient } from "./socket-client";

export interface NetworkRoomConfig {
  roomId: string;
  clientId: string;
  displayName: string;
  emoji?: string;
  color?: string;
  spectator?: boolean;
  /** Host flow: bring the room into existence if the server doesn't have it. */
  create?: boolean;
  url?: string;
}

/**
 * A shared room. The server owns the state; this client sends intent and
 * renders whatever comes back. Commands carry no actor id — the bridge stamps
 * it from the socket session, so a client can only ever act as itself.
 */
export class NetworkRoomRuntime implements RoomRuntime {
  readonly mode = "network" as const;
  readonly roomId: string;
  readonly selfId: string;
  private readonly client: SocketClient;
  private readonly listeners: RoomRuntimeListeners;
  private state: PublicGameState | null = null;
  private chat: ChatMessage[] = [];
  private destroyed = false;

  constructor(config: NetworkRoomConfig, listeners: RoomRuntimeListeners) {
    this.roomId = config.roomId;
    this.selfId = config.clientId;
    this.listeners = listeners;

    this.client = new SocketClient({
      url: config.url,
      roomId: config.roomId,
      clientId: config.clientId,
      displayName: config.displayName,
      emoji: config.emoji,
      color: config.color,
      spectator: config.spectator,
      create: config.create,
      onStatus: (status) => this.listeners.onStatus?.(status),
      onMessage: (message) => {
        if (this.destroyed) return;
        switch (message.type) {
          case "session-accepted":
            this.state = message.state;
            this.chat = message.chat;
            this.listeners.onPublicState(message.state);
            for (const line of message.chat) {
              this.listeners.onChat(line);
            }
            this.listeners.onStatus?.("connected");
            break;
          case "public-state":
            this.state = message.state;
            this.listeners.onPublicState(message.state);
            break;
          case "game-events":
            this.listeners.onEvents(message.events);
            break;
          case "chat":
            this.chat = [...this.chat, message.message].slice(-200);
            this.listeners.onChat(message.message);
            break;
          case "session-rejected":
            this.listeners.onStatus?.("rejected", message.message);
            break;
          case "connection-status":
            // The room keeps one connection per player: a second tab takes
            // the seat and this one has to say so rather than sit on stale
            // state.
            if (
              message.clientId === this.selfId &&
              message.status === "replaced"
            ) {
              this.listeners.onStatus?.(
                "rejected",
                "This room was opened in another tab.",
              );
            }
            break;
          case "message-rejected":
            this.listeners.onEvents([
              {
                type: "command-rejected",
                commandType: "skip",
                reason: "invalid-command",
                message: message.message,
              },
            ]);
            break;
          default:
            break;
        }
      },
    });
  }

  getPublicState(): PublicGameState | null {
    return this.state;
  }

  getChatHistory(): ChatMessage[] {
    return [...this.chat];
  }

  /**
   * `actorId` is ignored on purpose: the server derives the actor from the
   * authenticated socket session. It stays in the signature so components can
   * treat local and shared rooms identically.
   */
  sendCommand(_actorId: string, command: ClientGameCommand) {
    if (this.destroyed) return;
    this.client.sendCommand(`cmd-${Math.random().toString(36).slice(2)}`, command);
  }

  postChat(_authorId: string, _authorName: string, text: string) {
    if (this.destroyed) return;
    this.client.sendChat(text);
  }

  requestAiJudge(targetPlayerId: string) {
    if (this.destroyed) return;
    this.client.requestAiJudge(targetPlayerId);
  }

  addBot(bot: { id: string; displayName: string; profileId?: string; emoji?: string; color?: string }) {
    if (this.destroyed) return;
    this.client.addBot(bot);
  }

  get latencyMs(): number {
    return this.client.oneWayLatencyMs;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.client.close();
  }
}
