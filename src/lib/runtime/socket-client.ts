import { io, type Socket } from "socket.io-client";
import type { ClientGameCommand, ServerRealtimeMessage } from "@/lib/realtime";

export interface SocketClientOptions {
  url: string;
  roomId: string;
  clientId: string;
  displayName: string;
  onMessage: (message: ServerRealtimeMessage) => void;
}

export class SocketClient {
  private readonly socket: Socket;

  constructor(options: SocketClientOptions) {
    this.socket = io(options.url, {
      path: "/api/socket",
      transports: ["websocket", "polling"],
    });
    this.socket.on("connect", () => {
      this.socket.emit("join", {
        roomId: options.roomId,
        clientId: options.clientId,
        displayName: options.displayName,
      });
    });
    this.socket.on("message", (message: ServerRealtimeMessage) => {
      options.onMessage(message);
    });
  }

  sendCommand(commandId: string, command: ClientGameCommand) {
    this.socket.emit("command", { commandId, command });
  }

  close() {
    this.socket.close();
  }

  get connected() {
    return this.socket.connected;
  }
}
