import { io, type Socket } from "socket.io-client";
import { socketPath, type ClientGameCommand, type ServerRealtimeMessage } from "@/lib/realtime";

export interface SocketClientOptions {
  url?: string;
  roomId: string;
  clientId: string;
  displayName: string;
  emoji?: string;
  color?: string;
  spectator?: boolean;
  /** Create the room if it doesn't exist yet (host flow). */
  create?: boolean;
  onMessage: (message: ServerRealtimeMessage) => void;
  onStatus?: (status: "connecting" | "connected" | "reconnecting" | "disconnected") => void;
}

export class SocketClient {
  private readonly socket: Socket;
  private readonly options: SocketClientOptions;
  // Rolling RTT samples in ms, used to show the player their own latency.
  private rttSamples: number[] = [];
  private pingTimer: ReturnType<typeof setInterval> | undefined;

  constructor(options: SocketClientOptions) {
    this.options = options;
    this.socket = io(options.url ?? "", {
      path: socketPath,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4_000,
    });

    this.socket.on("connect", () => {
      options.onStatus?.("connected");
      this.join();
      this.beginPing();
    });
    this.socket.io.on("reconnect_attempt", () => options.onStatus?.("reconnecting"));
    this.socket.on("disconnect", () => {
      options.onStatus?.("disconnected");
      this.stopPing();
    });
    this.socket.on("connect_error", () => options.onStatus?.("reconnecting"));
    this.socket.on("message", (message: ServerRealtimeMessage) => {
      options.onMessage(message);
    });
    this.socket.on("latency-pong", (sentAt: number) => {
      this.rttSamples = [...this.rttSamples.slice(-9), Date.now() - sentAt];
    });
    options.onStatus?.("connecting");
  }

  /** Re-announces this client to the room — also used after a reconnect. */
  join() {
    this.socket.emit("join", {
      roomId: this.options.roomId,
      clientId: this.options.clientId,
      displayName: this.options.displayName,
      emoji: this.options.emoji,
      color: this.options.color,
      spectator: this.options.spectator,
      create: this.options.create,
    });
  }

  private beginPing() {
    this.stopPing();
    this.socket.emit("latency-ping", Date.now());
    this.pingTimer = setInterval(() => {
      this.socket.emit("latency-ping", Date.now());
    }, 5_000);
  }

  private stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = undefined;
  }

  /** Average round-trip time in ms (or 0 before any samples). */
  get rttMs(): number {
    if (this.rttSamples.length === 0) return 0;
    return this.rttSamples.reduce((total, value) => total + value, 0) / this.rttSamples.length;
  }

  /** Halve RTT to estimate one-way latency for client-perceived buzz time. */
  get oneWayLatencyMs(): number {
    return this.rttMs / 2;
  }

  sendCommand(commandId: string, command: ClientGameCommand) {
    this.socket.emit("command", { commandId, command });
  }

  sendChat(text: string) {
    this.socket.emit("chat", { text });
  }

  requestAiJudge(targetPlayerId: string) {
    this.socket.emit("ai-judge", { targetPlayerId });
  }

  addBot(bot: { id: string; displayName: string; profileId?: string; emoji?: string; color?: string }) {
    this.socket.emit("add-bot", bot);
  }

  close() {
    this.stopPing();
    this.socket.close();
  }

  get connected() {
    return this.socket.connected;
  }
}
