import type { BotProfile } from "@/lib/foundation/game-contracts";
import {
  type GameClue,
  type GamePlayer,
  type GameSettings,
  type GameState,
  type PublicGameState,
} from "@/lib/game";
import {
  RoomHost,
  type ChatMessage,
  type ClientGameCommand,
  type ServerRealtimeMessage,
} from "@/lib/realtime";
import type { RoomRuntime, RoomRuntimeListeners } from "./room-runtime";
import {
  beginReplayLog,
  persistReplayLog,
  recordCommand,
  recordEvents as recordReplayEvents,
} from "./replay-log";

export interface LocalRoomConfig {
  roomId: string;
  hostId: string;
  hostName: string;
  humanPlayers: { id: string; name: string; spectator?: boolean; emoji?: string; color?: string }[];
  bots: { id: string; name: string; profile: BotProfile; emoji?: string; color?: string }[];
  clues: GameClue[];
  settings?: Partial<GameSettings>;
  seed?: number;
}

export type LocalRoomListeners = RoomRuntimeListeners;

/**
 * Solo and pass-and-play. The authoritative room runs in this tab, driven by
 * the same RoomHost the server uses, so rules, bots and timing match a shared
 * room exactly.
 */
export class LocalRoomRuntime implements RoomRuntime {
  readonly mode = "local" as const;
  readonly roomId: string;
  readonly selfId: string;
  private readonly host: RoomHost;
  private readonly connectionByClient = new Map<string, string>();
  private readonly listeners: LocalRoomListeners;
  private readonly hostId: string;
  private destroyed = false;

  constructor(config: LocalRoomConfig, listeners: LocalRoomListeners) {
    const players: GamePlayer[] = [
      ...config.humanPlayers.map<GamePlayer>((player) => ({
        id: player.id,
        displayName: player.name,
        kind: "human",
        connected: true,
        spectator: Boolean(player.spectator),
        emoji: player.emoji,
        color: player.color,
      })),
      ...config.bots.map<GamePlayer>((bot) => ({
        id: bot.id,
        displayName: bot.name,
        kind: "ai-bot",
        connected: true,
        spectator: false,
        emoji: bot.emoji,
        color: bot.color,
      })),
    ];

    this.roomId = config.roomId;
    this.hostId = config.hostId;
    this.selfId = config.hostId;
    this.listeners = listeners;

    this.host = new RoomHost({
      roomId: config.roomId,
      players,
      clues: config.clues,
      settings: { hostId: config.hostId, ...config.settings },
      botProfiles: Object.fromEntries(config.bots.map((bot) => [bot.id, bot.profile])),
      seed: config.seed,
    });

    beginReplayLog(config.roomId);

    for (const player of players) {
      const session = this.host.room.issueSession(player.id);
      const connectionId = `conn-${player.id}`;
      this.connectionByClient.set(player.id, connectionId);
      this.host.room.connect({ ...session, connectionId }, (message) =>
        this.handleMessage(player.id, message),
      );
    }

    this.host.start();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.host.destroy();
  }

  getPublicState(): PublicGameState {
    return this.host.room.getPublicState();
  }

  getInternalState(): GameState {
    return this.host.getState();
  }

  getChatHistory(): ChatMessage[] {
    return this.host.room.getChatHistory();
  }

  sendCommand(actorId: string, command: ClientGameCommand) {
    if (this.destroyed) return;
    const connectionId = this.connectionByClient.get(actorId);
    recordCommand({ ...command, actorId } as never);
    if (!connectionId) {
      this.host.room.dispatch(actorId, command);
      return;
    }
    this.host.room.receive(connectionId, {
      type: "game-command",
      commandId: `cmd-${Math.random().toString(36).slice(2)}`,
      command,
    });
  }

  postChat(authorId: string, authorName: string, text: string) {
    if (this.destroyed) return;
    this.host.room.postChat({
      kind: "player",
      authorId,
      authorName,
      text,
    });
  }

  requestAiJudge(targetPlayerId: string) {
    if (this.destroyed) return;
    this.host.room.runAiJudge(targetPlayerId);
  }

  private handleMessage(clientId: string, message: ServerRealtimeMessage) {
    if (this.destroyed) return;
    // Every seat is connected locally; only mirror the host's view upward.
    if (clientId !== this.hostId) return;

    switch (message.type) {
      case "public-state":
        this.listeners.onPublicState(message.state);
        break;
      case "chat":
        this.listeners.onChat(message.message);
        break;
      case "game-events": {
        this.listeners.onEvents(message.events);
        recordReplayEvents(message.events);
        if (
          message.events.some(
            (event) => event.type === "round-advanced" && event.round === "complete",
          )
        ) {
          persistReplayLog();
        }
        break;
      }
      default:
        break;
    }
  }
}
