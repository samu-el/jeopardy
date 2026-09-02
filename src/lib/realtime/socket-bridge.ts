import { Server as SocketServer, type Socket } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { getRoom, getOrCreateRoom, normalizeRoomCode } from "./room-registry";
import type { RoomHost } from "./room-host";
import { socketPath } from "./socket-path";
import {
  type ClientGameCommand,
  type RealtimeMessageSink,
  type ServerRealtimeMessage,
} from "./contracts";

export { socketPath };

export interface JoinPayload {
  roomId: string;
  clientId: string;
  displayName?: string;
  emoji?: string;
  color?: string;
  spectator?: boolean;
  /** Only an explicit create request may bring a room into existence. */
  create?: boolean;
}

interface ActiveSession {
  room: RoomHost;
  clientId: string;
  connectionId: string;
}

let io: SocketServer | undefined;

export function attachSocketServer(server: HttpServer): SocketServer {
  if (io) return io;
  io = new SocketServer(server, {
    path: socketPath,
    // Same-origin in practice; the app is served by this very process.
    cors: { origin: true, methods: ["GET", "POST"] },
    // A dropped tab should free its seat quickly enough to be visible.
    pingTimeout: 20_000,
    pingInterval: 10_000,
  });

  io.on("connection", (socket: Socket) => {
    let session: ActiveSession | null = null;

    socket.on("join", (payload: JoinPayload) => {
      if (!payload?.roomId || !payload?.clientId) {
        socket.emit("message", rejection(socket.id, payload?.clientId ?? "", "invalid-session", "A room id and client id are required."));
        return;
      }
      const roomId = normalizeRoomCode(payload.roomId);
      const room = payload.create ? getOrCreateRoom(roomId) : getRoom(roomId);
      if (!room) {
        socket.emit(
          "message",
          rejection(socket.id, payload.clientId, "invalid-session", "That room does not exist."),
        );
        return;
      }

      // A reconnect replaces the previous connection for the same client.
      if (session && session.room !== room) {
        session.room.room.disconnect(session.connectionId);
      }

      const issued = room.room.issueSession(payload.clientId);
      const sink: RealtimeMessageSink = (message) => socket.emit("message", message);
      const result = room.room.connect(
        {
          clientId: payload.clientId,
          sessionToken: issued.sessionToken,
          connectionId: socket.id,
        },
        sink,
      );
      if (!result.ok) return;

      session = { room, clientId: payload.clientId, connectionId: socket.id };
      void socket.join(roomId);

      // Taking a seat is a game command so the engine owns the roster.
      room.room.dispatch(payload.clientId, {
        type: "join-game",
        displayName: payload.displayName?.trim() || "Player",
        spectator: payload.spectator,
        emoji: payload.emoji,
        color: payload.color,
      });
      socket.emit("joined", { roomId, clientId: payload.clientId });
    });

    socket.on("command", (payload: { commandId?: string; command: ClientGameCommand }) => {
      if (!session || !payload?.command) return;
      session.room.room.receive(session.connectionId, {
        type: "game-command",
        commandId: payload.commandId ?? `cmd-${Math.random().toString(36).slice(2)}`,
        command: payload.command,
      });
    });

    socket.on("chat", (payload: { text?: string }) => {
      if (!session || typeof payload?.text !== "string") return;
      session.room.room.receive(session.connectionId, {
        type: "chat",
        text: payload.text,
      });
    });

    socket.on("ai-judge", (payload: { targetPlayerId?: string }) => {
      if (!session || !payload?.targetPlayerId) return;
      session.room.room.receive(session.connectionId, {
        type: "ai-judge",
        targetPlayerId: payload.targetPlayerId,
      });
    });

    socket.on("add-bot", (payload: { id?: string; displayName?: string; profileId?: string; emoji?: string; color?: string }) => {
      if (!session || !payload?.id) return;
      const state = session.room.getState();
      if (state.settings.hostId && state.settings.hostId !== session.clientId) return;
      session.room.addBot({
        id: payload.id,
        displayName: payload.displayName ?? "Bot",
        profileId: payload.profileId,
        emoji: payload.emoji,
        color: payload.color,
      });
    });

    // Round-trip probe so clients can compensate for their own latency.
    socket.on("latency-ping", (sentAt: number) => {
      socket.emit("latency-pong", sentAt);
    });

    socket.on("disconnect", () => {
      if (!session) return;
      session.room.room.disconnect(session.connectionId);
      session = null;
    });
  });

  return io;
}

export function getSocketServer(): SocketServer | undefined {
  return io;
}

/** Test/teardown helper — detaches the server so a new one can be attached. */
export async function closeSocketServer() {
  if (!io) return;
  await io.close();
  io = undefined;
}

function rejection(
  connectionId: string,
  clientId: string,
  reason: "invalid-session",
  message: string,
): ServerRealtimeMessage {
  return { type: "session-rejected", connectionId, clientId, reason, message };
}
