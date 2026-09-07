import type { ClientGameCommand, ServerRealtimeMessage } from "./contracts";

/**
 * The room wire format: plain JSON frames over a plain WebSocket.
 *
 * Deliberately not Socket.IO. The room runs inside a Cloudflare Durable
 * Object in production, which speaks the standard WebSocket API and cannot
 * host Socket.IO's Node server — and the same frames work unchanged against
 * the local Node bridge used in development and the e2e suite.
 */

export interface ClientJoinFrame {
  t: "join";
  roomId: string;
  clientId: string;
  displayName?: string;
  emoji?: string;
  color?: string;
  spectator?: boolean;
  /** Only an explicit create request may bring a room into existence. */
  create?: boolean;
}

export type ClientFrame =
  | ClientJoinFrame
  | { t: "command"; commandId?: string; command: ClientGameCommand }
  | { t: "chat"; text: string }
  | { t: "ai-judge"; targetPlayerId: string }
  | {
      t: "add-bot";
      id: string;
      displayName?: string;
      profileId?: string;
      emoji?: string;
      color?: string;
    }
  | { t: "ping"; sentAt: number };

export type ServerFrame =
  | { t: "message"; message: ServerRealtimeMessage }
  | { t: "joined"; roomId: string; clientId: string }
  | { t: "pong"; sentAt: number };

export function encodeFrame(frame: ServerFrame | ClientFrame): string {
  return JSON.stringify(frame);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Parses a frame from the network. Anything that isn't a shape we recognise
 * comes back as undefined rather than throwing: a client — or something
 * pretending to be one — can send whatever it likes, and a room must not
 * fall over because of it.
 *
 * Only the envelope is checked here. The command inside a `command` frame is
 * the engine's to validate, which it already does, rejecting what it can't
 * apply.
 */
export function decodeClientFrame(raw: string): ClientFrame | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) return undefined;

  switch (parsed.t) {
    case "join":
      if (typeof parsed.roomId !== "string" || typeof parsed.clientId !== "string") {
        return undefined;
      }
      return {
        t: "join",
        roomId: parsed.roomId,
        clientId: parsed.clientId,
        displayName: asString(parsed.displayName),
        emoji: asString(parsed.emoji),
        color: asString(parsed.color),
        spectator: parsed.spectator === true,
        create: parsed.create === true,
      };
    case "command":
      if (!isRecord(parsed.command) || typeof parsed.command.type !== "string") {
        return undefined;
      }
      return {
        t: "command",
        commandId: asString(parsed.commandId),
        command: parsed.command as unknown as ClientGameCommand,
      };
    case "chat":
      if (typeof parsed.text !== "string") return undefined;
      return { t: "chat", text: parsed.text };
    case "ai-judge":
      if (typeof parsed.targetPlayerId !== "string") return undefined;
      return { t: "ai-judge", targetPlayerId: parsed.targetPlayerId };
    case "add-bot":
      if (typeof parsed.id !== "string") return undefined;
      return {
        t: "add-bot",
        id: parsed.id,
        displayName: asString(parsed.displayName),
        profileId: asString(parsed.profileId),
        emoji: asString(parsed.emoji),
        color: asString(parsed.color),
      };
    case "ping":
      if (typeof parsed.sentAt !== "number") return undefined;
      return { t: "ping", sentAt: parsed.sentAt };
    default:
      return undefined;
  }
}

export function decodeServerFrame(raw: string): ServerFrame | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) return undefined;
  switch (parsed.t) {
    case "message":
      if (!isRecord(parsed.message)) return undefined;
      return { t: "message", message: parsed.message as unknown as ServerRealtimeMessage };
    case "joined":
      if (typeof parsed.roomId !== "string" || typeof parsed.clientId !== "string") {
        return undefined;
      }
      return { t: "joined", roomId: parsed.roomId, clientId: parsed.clientId };
    case "pong":
      if (typeof parsed.sentAt !== "number") return undefined;
      return { t: "pong", sentAt: parsed.sentAt };
    default:
      return undefined;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
