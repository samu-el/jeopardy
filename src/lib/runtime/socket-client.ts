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
  // Rolling RTT samples in ms. Buzz commands subtract half of this so that
  // distant players don't lose by their network alone.
  private rttSamples: number[] = [];
  private pingTimer: ReturnType<typeof setInterval> | undefined;

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
      this.beginPing();
    });
    this.socket.on("disconnect", () => {
      this.stopPing();
    });
    this.socket.on("message", (message: ServerRealtimeMessage) => {
      options.onMessage(message);
    });
    this.socket.on("pong", (sentAt: number) => {
      const sample = Date.now() - sentAt;
      this.rttSamples = [...this.rttSamples.slice(-9), sample];
    });
  }

  private beginPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.socket.emit("ping", Date.now());
    }, 5_000);
  }

  private stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = undefined;
  }

  /** Average round-trip time in ms (or 0 before any samples). */
  get rttMs(): number {
    if (this.rttSamples.length === 0) return 0;
    const sum = this.rttSamples.reduce((acc, value) => acc + value, 0);
    return sum / this.rttSamples.length;
  }

  /** Halve RTT to estimate one-way latency for client-perceived buzz time. */
  get oneWayLatencyMs(): number {
    return this.rttMs / 2;
  }

  sendCommand(commandId: string, command: ClientGameCommand) {
    this.socket.emit("command", { commandId, command });
  }

  close() {
    this.stopPing();
    this.socket.close();
  }

  get connected() {
    return this.socket.connected;
  }
}
