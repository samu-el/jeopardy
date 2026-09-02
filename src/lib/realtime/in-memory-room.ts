import {
  dispatchGameCommand,
  getPublicGameState,
  reassignRoles,
  tickGame,
  type GameEvent,
  type GameState,
} from "@/lib/game";
import { judgeAnswer as fuzzyJudge } from "@/lib/ai/judge";
import {
  createChatMessage,
  sanitizeChatText,
  type ChatMessage,
  type ChatMessageInput,
} from "./chat";
import {
  commandFromClient,
  type ClientGameCommand,
  type ClientRealtimeMessage,
  type RealtimeClock,
  type RealtimeConnectResult,
  type RealtimeConnectionRecord,
  type RealtimeConnectionRequest,
  type RealtimeMessageSink,
  type RealtimeSession,
  type RealtimeTokenFactory,
  type ServerRealtimeMessage,
} from "./contracts";

export interface InMemoryRealtimeRoomOptions {
  initialState: GameState;
  clock?: RealtimeClock;
  tokenFactory?: RealtimeTokenFactory;
  /** Chat lines kept in memory and replayed to a joining client. */
  chatHistoryLimit?: number;
}

export type RoomChangeListener = (state: GameState, events: GameEvent[]) => void;

/**
 * The authoritative room. It owns the game state, stamps every command with
 * the connection's client id, and fans the resulting public state out to
 * every listener. The same class backs solo play in the browser and the
 * Socket.IO server, so both paths run identical rules.
 */
export class InMemoryRealtimeRoom {
  private state: GameState;
  private readonly clock: RealtimeClock;
  private readonly tokenFactory: RealtimeTokenFactory;
  private readonly chatHistoryLimit: number;
  private readonly sessions = new Map<string, RealtimeSession>();
  private readonly connections = new Map<
    string,
    RealtimeConnectionRecord & { sink: RealtimeMessageSink }
  >();
  private readonly activeConnectionByClient = new Map<string, string>();
  private readonly changeListeners = new Set<RoomChangeListener>();
  private chat: ChatMessage[] = [];

  constructor({
    initialState,
    clock = { now: () => Date.now() },
    tokenFactory = { createToken: defaultToken },
    chatHistoryLimit = 200,
  }: InMemoryRealtimeRoomOptions) {
    this.state = structuredClone(initialState);
    this.clock = clock;
    this.tokenFactory = tokenFactory;
    this.chatHistoryLimit = chatHistoryLimit;
  }

  getState() {
    return structuredClone(this.state);
  }

  getPublicState() {
    return getPublicGameState(this.state, this.clock.now());
  }

  getChatHistory(): ChatMessage[] {
    return [...this.chat];
  }

  /** Number of live connections, used to reap idle rooms. */
  get connectionCount(): number {
    return this.connections.size;
  }

  onChange(listener: RoomChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  issueSession(clientId: string): RealtimeSession {
    const existing = this.sessions.get(clientId);
    if (existing) {
      return existing;
    }

    const session = {
      clientId,
      sessionToken: this.tokenFactory.createToken(clientId),
    };
    this.sessions.set(clientId, session);
    return session;
  }

  connect(
    request: RealtimeConnectionRequest,
    sink: RealtimeMessageSink,
  ): RealtimeConnectResult {
    const session = this.sessions.get(request.clientId);
    if (!session || session.sessionToken !== request.sessionToken) {
      sink({
        type: "session-rejected",
        connectionId: request.connectionId,
        clientId: request.clientId,
        reason: "invalid-session",
        message: "Session token does not match the requested client id.",
      });
      return { ok: false, reason: "invalid-session" };
    }

    const previousConnectionId = this.activeConnectionByClient.get(request.clientId);
    if (previousConnectionId && previousConnectionId !== request.connectionId) {
      const previous = this.connections.get(previousConnectionId);
      if (previous) {
        previous.status = "replaced";
        previous.sink({
          type: "connection-status",
          clientId: request.clientId,
          connectionId: previousConnectionId,
          status: "replaced",
        });
      }
      this.connections.delete(previousConnectionId);
    }

    this.connections.set(request.connectionId, {
      ...request,
      connectedAt: this.clock.now(),
      status: "connected",
      sink,
    });
    this.activeConnectionByClient.set(request.clientId, request.connectionId);
    this.setPlayerConnected(request.clientId, true);

    sink({
      type: "session-accepted",
      connectionId: request.connectionId,
      clientId: request.clientId,
      sessionToken: request.sessionToken,
      state: this.getPublicState(),
      chat: this.getChatHistory(),
    });
    this.broadcast({
      type: "connection-status",
      clientId: request.clientId,
      connectionId: request.connectionId,
      status: "connected",
    });
    this.broadcastPublicState();
    return { ok: true };
  }

  disconnect(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    this.connections.delete(connectionId);
    if (this.activeConnectionByClient.get(connection.clientId) === connectionId) {
      this.activeConnectionByClient.delete(connection.clientId);
      if (this.state.round === "lobby") {
        // Nothing to preserve before the game starts — free the seat so the
        // pre-game roster only lists people who are actually here.
        this.applyCommand(connection.clientId, { type: "leave-game" });
      } else {
        // Mid-game the seat and score stay put so a refresh can reclaim them.
        this.setPlayerConnected(connection.clientId, false);
        this.migrateRolesAwayFrom(connection.clientId);
      }
    }

    connection.sink({
      type: "connection-status",
      clientId: connection.clientId,
      connectionId,
      status: "disconnected",
    });
    this.broadcast({
      type: "connection-status",
      clientId: connection.clientId,
      connectionId,
      status: "disconnected",
    });
    this.broadcastPublicState();
  }

  receive(connectionId: string, message: ClientRealtimeMessage) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== "connected") {
      const rejection: ServerRealtimeMessage = {
        type: "message-rejected",
        commandId: message.commandId,
        connectionId,
        reason: "unknown-connection",
        message: "Connection is not active.",
      };
      return { ok: false, message: rejection };
    }

    switch (message.type) {
      case "game-command":
        return this.applyCommand(connection.clientId, message.command, message.commandId);
      case "chat": {
        const player = this.state.players[connection.clientId];
        this.postChat({
          kind: "player",
          authorId: connection.clientId,
          authorName: player?.displayName ?? connection.clientId,
          text: message.text,
        });
        return { ok: true, events: [] };
      }
      case "ai-judge":
        this.runAiJudge(message.targetPlayerId);
        return { ok: true, events: [] };
      default: {
        const rejection: ServerRealtimeMessage = {
          type: "message-rejected",
          connectionId,
          reason: "unknown-message",
          message: "Realtime message type is not supported.",
        };
        connection.sink(rejection);
        return { ok: false, message: rejection };
      }
    }
  }

  /**
   * Runs a command on behalf of a player without a connection — bots, the
   * automation director, and server-side housekeeping all come through here.
   */
  dispatch(actorId: string, command: ClientGameCommand, commandId?: string) {
    return this.applyCommand(actorId, command, commandId);
  }

  /** Advances every time-driven transition. Cheap when nothing is due. */
  tick(now = this.clock.now()) {
    const before = this.state;
    const result = tickGame(before, now);
    if (result.state === before && result.events.length === 0) {
      return { ok: true, events: [] as GameEvent[] };
    }
    this.state = result.state;
    this.publish(result.events);
    return { ok: true, events: result.events };
  }

  postChat(input: ChatMessageInput) {
    const text = sanitizeChatText(input.text);
    if (!text) return undefined;
    const message = createChatMessage({
      ...input,
      text,
      timestamp: input.timestamp ?? this.clock.now(),
    });
    this.chat = [...this.chat, message].slice(-this.chatHistoryLimit);
    this.broadcast({ type: "chat", message });
    return message;
  }

  /**
   * Scores one queued answer with the fuzzy judge and reports the verdict to
   * the room. Runs where the state lives so every client sees the same call.
   */
  runAiJudge(targetPlayerId: string) {
    const active = this.state.activeClue;
    if (!active?.answerRevealed) return undefined;
    if (active.judges[targetPlayerId] !== undefined) return undefined;
    if (active.currentJudgePlayerId !== targetPlayerId) return undefined;

    const clue = this.state.cluesById[active.clueId];
    const answer = active.answers[targetPlayerId] ?? "";
    const verdict = fuzzyJudge({
      submittedAnswer: answer,
      expectedAnswer: clue.correctResponse,
    });
    const hostId = this.state.settings.hostId ?? targetPlayerId;
    this.applyCommand(hostId, {
      type: "judge-answer",
      targetPlayerId,
      correct: verdict.correct,
    });
    const player = this.state.players[targetPlayerId];
    this.postChat({
      kind: "judge",
      text: `${verdict.correct ? "✓" : "✗"} ${
        player?.displayName ?? targetPlayerId
      } · "${answer.trim() || "—"}" · ${(verdict.confidence * 100).toFixed(0)}%`,
    });
    return verdict;
  }

  private applyCommand(
    actorId: string,
    command: ClientGameCommand,
    commandId?: string,
  ) {
    const gameCommand = commandFromClient(actorId, command);
    const result = dispatchGameCommand(this.state, gameCommand, {
      now: this.clock.now(),
    });
    this.state = result.state;
    this.publish(result.events, commandId);
    return { ok: true, events: result.events };
  }

  private publish(events: GameEvent[], commandId?: string) {
    if (events.length > 0) {
      this.broadcast({ type: "game-events", commandId, events });
    }
    this.broadcastPublicState();
    for (const listener of this.changeListeners) {
      listener(this.state, events);
    }
  }

  private broadcast(message: ServerRealtimeMessage) {
    for (const connection of this.connections.values()) {
      if (connection.status === "connected") {
        connection.sink(message);
      }
    }
  }

  private broadcastPublicState() {
    this.broadcast({
      type: "public-state",
      state: this.getPublicState(),
    });
  }

  private setPlayerConnected(clientId: string, connected: boolean) {
    const player = this.state.players[clientId];
    if (!player || player.connected === connected) {
      return;
    }

    this.state = {
      ...this.state,
      updatedAt: this.clock.now(),
      players: {
        ...this.state.players,
        [clientId]: {
          ...player,
          connected,
        },
      },
    };
  }

  /** Keeps the room playable when the host or picker drops off. */
  private migrateRolesAwayFrom(clientId: string) {
    if (
      this.state.settings.hostId !== clientId &&
      this.state.pickerId !== clientId
    ) {
      return;
    }
    const next = reassignRoles(this.state, clientId);
    if (next === this.state) return;
    this.state = { ...next, updatedAt: this.clock.now() };
    const host = this.state.settings.hostId;
    if (host && host !== clientId) {
      this.postChat({
        kind: "system",
        text: `${this.state.players[host]?.displayName ?? host} is now hosting`,
      });
    }
  }
}

function defaultToken(clientId: string) {
  return `session-${clientId}`;
}
