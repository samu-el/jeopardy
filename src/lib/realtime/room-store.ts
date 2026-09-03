import type { BotProfile } from "@/lib/foundation/game-contracts";
import type { GameState } from "@/lib/game";
import type { ChatMessage } from "./chat";

/** Bumped when the snapshot shape changes; older payloads are discarded. */
export const roomSnapshotVersion = 1;

/**
 * Everything needed to bring a room back exactly as it was: the
 * authoritative state, the chat that goes with it, and which seats are bots
 * so the director can pick their play back up.
 */
export interface RoomSnapshot {
  version: number;
  roomId: string;
  state: GameState;
  chat: ChatMessage[];
  bots: Record<string, BotProfile>;
  savedAt: number;
}

/**
 * Where rooms live between restarts. Every method is allowed to fail — a
 * store outage degrades the app to in-memory rooms rather than taking play
 * down, so callers treat errors as "not stored".
 */
export interface RoomStore {
  readonly kind: string;
  load(roomId: string): Promise<RoomSnapshot | undefined>;
  save(snapshot: RoomSnapshot): Promise<void>;
  delete(roomId: string): Promise<void>;
  /** Room ids currently held. Used by tooling, not by the hot path. */
  list(): Promise<string[]>;
  close?(): Promise<void>;
}

/** The default: rooms live only as long as the process does. */
export class NullRoomStore implements RoomStore {
  readonly kind = "memory-only";

  async load(): Promise<RoomSnapshot | undefined> {
    return undefined;
  }

  async save(): Promise<void> {}

  async delete(): Promise<void> {}

  async list(): Promise<string[]> {
    return [];
  }
}

/** A real store with no server behind it, for tests and local development. */
export class InMemoryRoomStore implements RoomStore {
  readonly kind = "in-memory";
  private readonly rooms = new Map<string, string>();
  /** Set by tests to prove the app keeps playing when the store is down. */
  failing = false;

  async load(roomId: string): Promise<RoomSnapshot | undefined> {
    this.guard();
    const raw = this.rooms.get(roomId);
    return raw ? (JSON.parse(raw) as RoomSnapshot) : undefined;
  }

  async save(snapshot: RoomSnapshot): Promise<void> {
    this.guard();
    this.rooms.set(snapshot.roomId, JSON.stringify(snapshot));
  }

  async delete(roomId: string): Promise<void> {
    this.guard();
    this.rooms.delete(roomId);
  }

  async list(): Promise<string[]> {
    this.guard();
    return [...this.rooms.keys()];
  }

  get size(): number {
    return this.rooms.size;
  }

  private guard() {
    if (this.failing) {
      throw new Error("room store is unavailable");
    }
  }
}

export function isUsableSnapshot(value: unknown): value is RoomSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<RoomSnapshot>;
  return (
    snapshot.version === roomSnapshotVersion &&
    typeof snapshot.roomId === "string" &&
    Boolean(snapshot.state) &&
    Array.isArray(snapshot.chat)
  );
}
