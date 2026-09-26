import {
  decodeServerFrame,
  encodeFrame,
  socketPath,
  type ClientFrame,
  type ClientGameCommand,
  type ServerRealtimeMessage,
} from "@/lib/realtime";

export interface SocketClientOptions {
  /**
   * Where the rooms live. Defaults to this origin, which is what local
   * development and the e2e suite use. In production it points at the
   * Cloudflare Worker (`NEXT_PUBLIC_ROOMS_URL`), because a serverless host
   * cannot hold a room open.
   */
  url?: string;
  roomId: string;
  clientId: string;
  displayName: string;
  emoji?: string;
  color?: string;
  spectator?: boolean;
  /** Create the room if it doesn't exist yet (host flow). */
  create?: boolean;
  /** The token this client last held in this room, offered to reclaim the seat. */
  sessionToken?: string;
  onMessage: (message: ServerRealtimeMessage) => void;
  onStatus?: (status: "connecting" | "connected" | "reconnecting" | "disconnected") => void;
}

const maxReconnectDelayMs = 8_000;
const pingIntervalMs = 5_000;
/**
 * How old a game command may be when the socket comes back and still be
 * sent. A buzz or a pick made during an outage was aimed at a board that has
 * moved on since; replaying it late is worse than dropping it.
 */
export const staleIntentMs = 1_000;

/** Frames that carry game intent, as opposed to plumbing and chat. */
function isGameIntent(frame: ClientFrame): boolean {
  return frame.t === "command" || frame.t === "ai-judge" || frame.t === "add-bot";
}

/**
 * Which queued frames still go out when the socket opens. Before the first
 * connection everything does (the host deals the board before the socket is
 * up), but after a drop, game intent older than `staleIntentMs` is
 * discarded. Pings are never replayed; the ping loop restarts on its own.
 */
export function framesToReplay(
  queue: readonly { frame: ClientFrame; at: number }[],
  options: { everConnected: boolean; now: number },
): ClientFrame[] {
  return queue
    .filter(({ frame, at }) => {
      if (frame.t === "ping" || frame.t === "join") return false;
      if (!options.everConnected) return true;
      return !isGameIntent(frame) || options.now - at <= staleIntentMs;
    })
    .map(({ frame }) => frame);
}

/**
 * A room connection over a plain WebSocket, with the reconnect behaviour the
 * app used to get from Socket.IO: back off, re-open, re-join, and keep
 * measuring the round trip so the UI can show a player their own latency.
 */
export class SocketClient {
  private readonly options: SocketClientOptions;
  private socket: WebSocket | undefined;
  // Rolling RTT samples in ms, used to show the player their own latency.
  private rttSamples: number[] = [];
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private reconnectDelayMs = 500;
  private disposed = false;
  /** Frames written while the socket was down, replayed (if still fresh) once it's up. */
  private queue: { frame: ClientFrame; at: number }[] = [];
  /** Set once the room has accepted this client at least once. */
  private accepted = false;
  private everOpened = false;
  private sessionToken: string | undefined;
  private create: boolean;

  constructor(options: SocketClientOptions) {
    this.options = options;
    this.sessionToken = options.sessionToken;
    this.create = Boolean(options.create);
    this.open();
  }

  private endpoint(): string {
    const configured = (this.options.url ?? process.env.NEXT_PUBLIC_ROOMS_URL ?? "").trim();
    const url = configured
      ? new URL(configured)
      : new URL(`${window.location.origin}${socketPath}`);
    // Accept http(s):// or ws(s):// in configuration; the socket needs ws(s).
    if (url.protocol === "http:") url.protocol = "ws:";
    else if (url.protocol === "https:") url.protocol = "wss:";
    if (url.pathname === "/" || url.pathname === "") url.pathname = socketPath;
    // The room code rides on the URL, not just the join frame: the Durable
    // Object that owns the room is picked before a single frame is read.
    url.searchParams.set("room", this.options.roomId);
    return url.toString();
  }

  private open() {
    if (this.disposed) return;
    this.options.onStatus?.(this.rttSamples.length > 0 ? "reconnecting" : "connecting");
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.endpoint());
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectDelayMs = 500;
      this.options.onStatus?.("connected");
      // The room only knows this connection once it has joined, so the join
      // goes first — before anything the caller queued while we were down.
      this.join();
      const pending = framesToReplay(this.queue, {
        everConnected: this.everOpened,
        now: Date.now(),
      });
      this.queue = [];
      this.everOpened = true;
      for (const frame of pending) this.write(frame);
      this.beginPing();
    };

    socket.onmessage = (event) => {
      const frame = decodeServerFrame(
        typeof event.data === "string" ? event.data : String(event.data),
      );
      if (!frame) return;
      if (frame.t === "message") {
        if (frame.message.type === "session-accepted") {
          this.accepted = true;
          this.sessionToken = frame.message.sessionToken;
          // The room exists now. A re-join after a drop must never ask to
          // create it again, or it would collide with itself.
          this.create = false;
        }
        this.options.onMessage(frame.message);
        return;
      }
      if (frame.t === "pong") {
        this.rttSamples = [...this.rttSamples.slice(-9), Date.now() - frame.sentAt];
      }
    };

    socket.onclose = () => {
      this.stopPing();
      if (this.disposed) {
        this.options.onStatus?.("disconnected");
        return;
      }
      this.scheduleReconnect();
    };

    // `onerror` is always followed by `onclose`, so reconnecting is left to
    // that one path rather than raced from both.
    socket.onerror = () => {};
  }

  private scheduleReconnect() {
    if (this.disposed || this.reconnectTimer) return;
    this.options.onStatus?.("reconnecting");
    const delay = this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(delay * 2, maxReconnectDelayMs);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.open();
    }, delay);
  }

  private write(frame: ClientFrame) {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      // Held across a blip, bounded, and stamped so that whatever is stale
      // by the time the socket is back gets dropped rather than replayed.
      if (frame.t === "ping") return;
      this.queue = [...this.queue.slice(-31), { frame, at: Date.now() }];
      return;
    }
    socket.send(encodeFrame(frame));
  }

  /** Re-announces this client to the room — also used after a reconnect. */
  join() {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(
      encodeFrame({
        t: "join",
        roomId: this.options.roomId,
        clientId: this.options.clientId,
        displayName: this.options.displayName,
        emoji: this.options.emoji,
        color: this.options.color,
        spectator: this.options.spectator,
        create: this.create,
        sessionToken: this.sessionToken,
      }),
    );
  }

  private beginPing() {
    this.stopPing();
    this.write({ t: "ping", sentAt: Date.now() });
    this.pingTimer = setInterval(() => {
      this.write({ t: "ping", sentAt: Date.now() });
    }, pingIntervalMs);
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
    this.write({ t: "command", commandId, command });
  }

  sendChat(text: string) {
    this.write({ t: "chat", text });
  }

  requestAiJudge(targetPlayerId: string) {
    this.write({ t: "ai-judge", targetPlayerId });
  }

  addBot(bot: { id: string; displayName: string; profileId?: string; emoji?: string; color?: string }) {
    this.write({ t: "add-bot", ...bot });
  }

  close() {
    this.disposed = true;
    this.stopPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.queue = [];
    this.socket?.close();
    this.socket = undefined;
  }

  get connected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /** True once the room has let this client in at least once. */
  get everAccepted() {
    return this.accepted;
  }

  /** The token the room last issued, to be offered on the next visit. */
  get currentSessionToken() {
    return this.sessionToken;
  }
}
