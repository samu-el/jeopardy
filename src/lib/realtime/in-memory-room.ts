import {
  dispatchGameCommand,
  getPublicGameState,
  type GameState,
} from "@/lib/game";
import {
  commandFromClient,
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
}

export class InMemoryRealtimeRoom {
  private state: GameState;
  private readonly clock: RealtimeClock;
  private readonly tokenFactory: RealtimeTokenFactory;
  private readonly sessions = new Map<string, RealtimeSession>();
  private readonly connections = new Map<
    string,
    RealtimeConnectionRecord & { sink: RealtimeMessageSink }
  >();
  private readonly activeConnectionByClient = new Map<string, string>();

  constructor({
    initialState,
    clock = { now: () => Date.now() },
    tokenFactory = { createToken: defaultToken },
  }: InMemoryRealtimeRoomOptions) {
    this.state = structuredClone(initialState);
    this.clock = clock;
    this.tokenFactory = tokenFactory;
  }

  getState() {
    return structuredClone(this.state);
  }

  getPublicState() {
    return getPublicGameState(this.state, this.clock.now());
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
    if (previousConnectionId) {
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
      this.setPlayerConnected(connection.clientId, false);
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

    if (message.type !== "game-command") {
      const rejection: ServerRealtimeMessage = {
        type: "message-rejected",
        commandId: message.commandId,
        connectionId,
        reason: "unknown-message",
        message: "Realtime message type is not supported.",
      };
      connection.sink(rejection);
      return { ok: false, message: rejection };
    }

    const command = commandFromClient(connection.clientId, message.command);
    const result = dispatchGameCommand(this.state, command, {
      now: this.clock.now(),
    });
    this.state = result.state;
    this.broadcast({
      type: "game-events",
      commandId: message.commandId,
      events: result.events,
    });
    this.broadcastPublicState();
    return { ok: true, events: result.events };
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
}

function defaultToken(clientId: string) {
  return `session-${clientId}`;
}
