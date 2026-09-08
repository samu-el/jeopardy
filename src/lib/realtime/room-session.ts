import type { RoomHost } from "./room-host";
import type { RealtimeMessageSink, ServerRealtimeMessage } from "./contracts";
import { decodeClientFrame, type ClientFrame, type ServerFrame } from "./ws-protocol";

/**
 * Everything one connected client can ask a room to do, with no transport
 * in sight. The Node bridge (development, e2e) and the Cloudflare Durable
 * Object (production) both drive this, so the rules about who may do what
 * are written down once.
 */
export interface RoomSessionOptions {
  /** Stable id for this connection inside the room. */
  connectionId: string;
  /**
   * Finds the room a join frame asks for. `create` is only ever true when the
   * client explicitly asked to open a room, so a typo in a code can't
   * conjure an empty one.
   */
  resolveRoom: (roomId: string, create: boolean) => Promise<RoomHost | undefined>;
  send: (frame: ServerFrame) => void;
}

export class RoomSession {
  private readonly options: RoomSessionOptions;
  private room: RoomHost | undefined;
  private clientId: string | undefined;
  private closed = false;

  constructor(options: RoomSessionOptions) {
    this.options = options;
  }

  /** Handles one raw frame off the wire. */
  async receive(raw: string): Promise<void> {
    const frame = decodeClientFrame(raw);
    if (!frame) return;
    await this.handle(frame);
  }

  async handle(frame: ClientFrame): Promise<void> {
    if (this.closed) return;
    switch (frame.t) {
      case "join":
        await this.join(frame.roomId, frame);
        return;
      case "command":
        if (!this.room) return;
        this.room.room.receive(this.options.connectionId, {
          type: "game-command",
          commandId: frame.commandId ?? `cmd-${Math.random().toString(36).slice(2)}`,
          command: frame.command,
        });
        return;
      case "chat":
        if (!this.room) return;
        this.room.room.receive(this.options.connectionId, {
          type: "chat",
          text: frame.text,
        });
        return;
      case "ai-judge":
        if (!this.room) return;
        this.room.room.receive(this.options.connectionId, {
          type: "ai-judge",
          targetPlayerId: frame.targetPlayerId,
        });
        return;
      case "add-bot": {
        if (!this.room || !this.clientId) return;
        const state = this.room.getState();
        // Only the host fills seats.
        if (state.settings.hostId && state.settings.hostId !== this.clientId) return;
        this.room.addBot({
          id: frame.id,
          displayName: frame.displayName ?? "Bot",
          profileId: frame.profileId,
          emoji: frame.emoji,
          color: frame.color,
        });
        return;
      }
      case "ping":
        // Round-trip probe, so a client can show its own latency.
        this.options.send({ t: "pong", sentAt: frame.sentAt });
        return;
    }
  }

  private async join(roomId: string, frame: Extract<ClientFrame, { t: "join" }>) {
    const room = await this.options.resolveRoom(roomId, frame.create === true);
    if (this.closed) return;
    if (!room) {
      this.options.send({
        t: "message",
        message: this.rejection(frame.clientId, "That room does not exist."),
      });
      return;
    }

    // A reconnect that lands on a different room releases the old seat.
    if (this.room && this.room !== room) {
      this.room.room.disconnect(this.options.connectionId);
    }

    const issued = room.room.issueSession(frame.clientId);
    const sink: RealtimeMessageSink = (message) =>
      this.options.send({ t: "message", message });
    const result = room.room.connect(
      {
        clientId: frame.clientId,
        sessionToken: issued.sessionToken,
        connectionId: this.options.connectionId,
      },
      sink,
    );
    if (!result.ok) return;
    if (this.closed) {
      // The client gave up while the room was still loading.
      room.room.disconnect(this.options.connectionId);
      return;
    }

    this.room = room;
    this.clientId = frame.clientId;

    // Taking a seat is a game command, so the engine owns the roster and
    // every client hears about it through the normal state broadcast.
    room.room.dispatch(frame.clientId, {
      type: "join-game",
      displayName: frame.displayName?.trim() || "Player",
      spectator: frame.spectator,
      emoji: frame.emoji,
      color: frame.color,
    });
    this.options.send({ t: "joined", roomId, clientId: frame.clientId });
  }

  /** The socket went away: free the seat this connection was holding. */
  close() {
    if (this.closed) return;
    this.closed = true;
    this.room?.room.disconnect(this.options.connectionId);
    this.room = undefined;
  }

  /** The room this session is attached to, once it has joined one. */
  get attachedRoom(): RoomHost | undefined {
    return this.room;
  }

  private rejection(clientId: string, message: string): ServerRealtimeMessage {
    return {
      type: "session-rejected",
      connectionId: this.options.connectionId,
      clientId,
      reason: "invalid-session",
      message,
    };
  }
}
