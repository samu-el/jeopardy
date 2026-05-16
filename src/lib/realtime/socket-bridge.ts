import { Server as SocketServer, type Socket } from "socket.io";
import type { Server as HttpServer } from "node:http";
import {
  createGame,
  type GameClue,
  type GamePlayer,
  type GameSettings,
} from "@/lib/game";
import { InMemoryRealtimeRoom } from "./in-memory-room";
import {
  type ClientGameCommand,
  type ClientRealtimeMessage,
  type RealtimeConnectionRecord,
  type RealtimeMessageSink,
  type ServerRealtimeMessage,
} from "./contracts";

export interface BridgeRoomInit {
  roomId: string;
  hostId: string;
  players: GamePlayer[];
  clues: GameClue[];
  settings?: Partial<GameSettings>;
}

interface BridgeRoom {
  room: InMemoryRealtimeRoom;
  socketsByConnection: Map<string, Socket>;
}

const rooms = new Map<string, BridgeRoom>();

export function getOrCreateBridgeRoom(init: BridgeRoomInit) {
  let entry = rooms.get(init.roomId);
  if (entry) return entry;
  const game = createGame({
    roomId: init.roomId,
    players: init.players,
    clues: init.clues,
    now: Date.now(),
    settings: init.settings,
  });
  entry = {
    room: new InMemoryRealtimeRoom({ initialState: game }),
    socketsByConnection: new Map(),
  };
  rooms.set(init.roomId, entry);
  return entry;
}

export function clearBridgeRoom(roomId: string) {
  rooms.delete(roomId);
}

export function hasBridgeRoom(roomId: string): boolean {
  return rooms.has(roomId);
}

export function listBridgeRoomIds(): string[] {
  return Array.from(rooms.keys());
}

let io: SocketServer | undefined;

export function attachSocketServer(server: HttpServer): SocketServer {
  if (io) return io;
  io = new SocketServer(server, {
    path: "/api/socket",
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", (socket: Socket) => {
    let activeConnection: RealtimeConnectionRecord | null = null;
    let activeRoom: BridgeRoom | null = null;

    socket.on("join", (payload: { roomId: string; clientId: string; displayName?: string }) => {
      const entry = rooms.get(payload.roomId);
      if (!entry) {
        socket.emit("message", {
          type: "session-rejected",
          connectionId: socket.id,
          clientId: payload.clientId,
          reason: "invalid-session",
          message: "Room does not exist.",
        } satisfies ServerRealtimeMessage);
        return;
      }
      const session = entry.room.issueSession(payload.clientId);
      const connectionId = socket.id;
      const sink: RealtimeMessageSink = (message) => {
        socket.emit("message", message);
      };
      entry.socketsByConnection.set(connectionId, socket);
      const result = entry.room.connect(
        { clientId: payload.clientId, sessionToken: session.sessionToken, connectionId },
        sink,
      );
      activeRoom = entry;
      activeConnection = {
        clientId: payload.clientId,
        sessionToken: session.sessionToken,
        connectionId,
        connectedAt: Date.now(),
        status: result.ok ? "connected" : "disconnected",
      };
    });

    socket.on("command", (payload: { commandId: string; command: ClientGameCommand }) => {
      if (!activeRoom || !activeConnection) return;
      const message: ClientRealtimeMessage = {
        type: "game-command",
        commandId: payload.commandId,
        command: payload.command,
      };
      activeRoom.room.receive(activeConnection.connectionId, message);
    });

    socket.on("disconnect", () => {
      if (!activeRoom || !activeConnection) return;
      activeRoom.room.disconnect(activeConnection.connectionId);
      activeRoom.socketsByConnection.delete(activeConnection.connectionId);
    });
  });

  return io;
}
